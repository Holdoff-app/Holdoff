/**
 * Contact Insights Route for HoldOff
 * Fetches relationship profile, flags, compatibility, and trends for a contact
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/auth');
const { callWithFallback } = require('../lib/verdict-ai');
const {
  getContact,
  getContactInsights,
  upsertContactInsights,
  getMessageHistory,
  getMessageStats,
} = require('../db/contacts');

const RELATIONSHIP_ANALYSIS_PROMPT = `You are HoldOff's relationship analyst. Given a contact's communication patterns and message history metadata, generate a structured relationship analysis.

Respond ONLY with valid JSON (no markdown, no code blocks) in this exact structure:
{
  "redFlags": ["string", ...],
  "yellowFlags": ["string", ...],
  "greenFlags": ["string", ...],
  "compatibilityScore": <number 0-100>,
  "attachmentStyleFit": "<one of: Secure, Anxious, Avoidant, Fearful-Avoidant, Dismissive-Avoidant>",
  "communicationStyleMatch": <number 0-100>,
  "riskLevel": "<Low|Medium|High>",
  "trustLevel": "<Growing|Stable|Declining>",
  "compatibilitySummary": "2-3 sentence summary of compatibility"
}

Red flags: serious warning signs (e.g. hot/cold cycling, stonewalling, inconsistent effort).
Yellow flags: areas to watch (e.g. slow replies only when busy, mixed signals under stress).
Green flags: genuinely positive signs (e.g. consistent communication, respects boundaries).
Keep each flag to one clear, specific sentence. Return 2-5 items per category.`;

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * GET /api/contact-insights/:contactId
 * Fetch full insights profile for a contact
 */
router.get('/:contactId', requireAuth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id;

    const contact = await getContact(contactId, userId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const insights = await getContactInsights(userId, contactId);

    if (!insights) {
      // Return empty profile if no insights yet
      return res.json({
        contactId,
        contact: {
          id: contact.id,
          name: contact.display_name,
          phoneNumber: contact.phone_number,
        },
        insights: {
          redFlags: [],
          yellowFlags: [],
          greenFlags: [],
          riskLevel: 'Not yet analyzed',
          trustLevel: 'Unknown',
          attachmentStyleFit: null,
          communicationStyleMatch: 0,
          compatibilityScore: 0,
          analysisCount: 0,
          updatedAt: null,
        },
      });
    }

    // Parse JSON fields
    res.json({
      contactId,
      contact: {
        id: contact.id,
        name: contact.display_name,
        phoneNumber: contact.phone_number,
      },
      insights: {
        redFlags: parseJsonArray(insights.red_flags),
        yellowFlags: parseJsonArray(insights.yellow_flags),
        greenFlags: parseJsonArray(insights.green_flags),
        riskLevel: insights.risk_level,
        trustLevel: insights.trust_level,
        attachmentStyleFit: insights.attachment_style_fit,
        communicationStyleMatch: insights.communication_style_match,
        compatibilityScore: insights.compatibility_score,
        compatibilitySummary: insights.compatibility_summary || '',
        lastAnalyzedMessage: insights.last_analyzed_message,
        analysisCount: insights.analysis_count,
        updatedAt: insights.updated_at,
      },
    });
  } catch (err) {
    console.error('[API /contact-insights] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch insights', details: err.message });
  }
});

/**
 * POST /api/contact-insights/:contactId
 * Store/update insights for a contact after interpretation
 */
router.post('/:contactId', requireAuth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id;
    const insights = req.body;

    const contact = await getContact(contactId, userId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updated = await upsertContactInsights(userId, contactId, insights);

    res.json({
      contactId,
      insights: {
        redFlags: parseJsonArray(updated.red_flags),
        yellowFlags: parseJsonArray(updated.yellow_flags),
        greenFlags: parseJsonArray(updated.green_flags),
        riskLevel: updated.risk_level,
        trustLevel: updated.trust_level,
        attachmentStyleFit: updated.attachment_style_fit,
        communicationStyleMatch: updated.communication_style_match,
        compatibilityScore: updated.compatibility_score,
        compatibilitySummary: updated.compatibility_summary || '',
        analysisCount: updated.analysis_count,
        updatedAt: updated.updated_at,
      },
    });
  } catch (err) {
    console.error('[API /contact-insights POST] Error:', err.message);
    res.status(500).json({ error: 'Failed to store insights', details: err.message });
  }
});

/**
 * POST /api/contact-insights/:contactId/analyze
 * AI-generate red/yellow/green flags + compatibility from message history metadata
 */
router.post('/:contactId/analyze', requireAuth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id;

    const contact = await getContact(contactId, userId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Gather message stats and recent history for context
    let stats = null;
    let history = [];
    try {
      stats = await getMessageStats(userId, contactId);
      history = await getMessageHistory(userId, contactId, { limit: 20 });
    } catch (_) {
      // Non-fatal — proceed with whatever we have
    }

    const totalMessages = (Number(stats?.sent_count) || 0) + (Number(stats?.received_count) || 0);

    // Build context for AI
    const patternSummary = history.length > 0
      ? history.slice(0, 10).map(m =>
          `[${m.direction || 'sent'}] pattern=${m.pattern_name || 'none'} verdict=${m.verdict || 'none'} hour=${m.hour_of_day ?? '?'}`
        ).join('\n')
      : 'No message history available yet.';

    const userContent = `Contact: ${contact.display_name || 'Unknown'} (relationship: ${contact.relationship || 'unspecified'})
Duration: ${contact.duration_days ? contact.duration_days + ' days' : 'unknown'}
Total messages tracked: ${totalMessages}
Messages sent by user: ${stats?.sent_count || 0}
Messages received: ${stats?.received_count || 0}
HOLD verdicts: ${stats?.hold_count || 0}
REWRITE verdicts: ${stats?.rewrite_count || 0}
Late-night messages: ${stats?.night_count || 0}
Weekend messages: ${stats?.weekend_count || 0}

Recent communication patterns:
${patternSummary}

Analyze this relationship and return the JSON.`;

    const noop = () => {};
    let raw, source;
    try {
      const result = await callWithFallback(RELATIONSHIP_ANALYSIS_PROMPT, userContent, noop);
      raw = result.raw;
      source = result.source;
    } catch (aiErr) {
      console.error('[contact-insights/analyze] AI call failed:', aiErr.message);
      return res.status(503).json({ error: 'AI analysis unavailable. Try again in a moment.' });
    }

    // Parse AI response
    let parsed;
    try {
      let clean = raw.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      }
      parsed = JSON.parse(clean);
    } catch (_) {
      console.error('[contact-insights/analyze] JSON parse failed, raw:', raw?.slice(0, 200));
      return res.status(500).json({ error: 'Analysis parse failed. Try again.' });
    }

    // Save to contact_insights table
    const saved = await upsertContactInsights(userId, contactId, {
      redFlags: parsed.redFlags || [],
      yellowFlags: parsed.yellowFlags || [],
      greenFlags: parsed.greenFlags || [],
      riskLevel: parsed.riskLevel || 'Medium',
      trustLevel: parsed.trustLevel || 'Stable',
      attachmentStyleFit: parsed.attachmentStyleFit || null,
      communicationStyleMatch: parsed.communicationStyleMatch || 0,
      compatibilityScore: parsed.compatibilityScore || 0,
      compatibilitySummary: parsed.compatibilitySummary || '',
      lastAnalyzedMessage: null,
      analysisTimestamp: new Date(),
    });

    res.json({
      contactId,
      source,
      insights: {
        redFlags: parsed.redFlags || [],
        yellowFlags: parsed.yellowFlags || [],
        greenFlags: parsed.greenFlags || [],
        compatibilityScore: parsed.compatibilityScore || 0,
        compatibilitySummary: parsed.compatibilitySummary || '',
        attachmentStyleFit: parsed.attachmentStyleFit || null,
        communicationStyleMatch: parsed.communicationStyleMatch || 0,
        riskLevel: parsed.riskLevel || 'Medium',
        trustLevel: parsed.trustLevel || 'Stable',
        analysisCount: saved?.analysis_count ?? 1,
        updatedAt: saved?.updated_at ?? new Date(),
      },
    });
  } catch (err) {
    console.error('[API /contact-insights/analyze] Error:', err.message);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

module.exports = router;
