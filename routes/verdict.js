/**
 * Verdict Route for HoldOff
 * - POST /api/verdict: outgoing-message recipient-read analysis
 * - GET /api/verdict/history: paginated verdict history for the logged-in user
 * - GET /api/verdict/streak: current streak + total verdict count
 * - GET /api/verdict/count/:userId: total verdict count for the logged-in user
 *
 * Fix #3: POST / now accepts threadHistory (array of {direction, body, timestamp})
 * and passes the last 30 messages as context to the AI so Sadie sees the full
 * relationship pattern, not just the single outgoing draft.
 */

const express = require('express');
const router = express.Router();
const db = require('../db/messages');
const { requireAuth } = require('../lib/auth');
const {
  getVerdictHistory,
  getStreak,
  getTotalVerdictCount,
} = require('../db/verdict-history');
const { validateHistoryQuery } = require('../lib/request-validators');
const { callAI } = require('../services/ai-provider');
const { buildOutgoingVerdictFallback } = require('../services/resilient-ai');

const VALID_SAFETY_LEVELS = new Set(['green', 'yellow', 'red', 'spiral']);
const VALID_ATTACHMENT_PATTERNS = new Set(['ANX', 'AVO', 'FA', 'SEC']);

function buildLegacyAnalysis(verdict) {
  return `**How they'll read it:** ${verdict.recipientRead}\n\n**Your concern:** ${verdict.userAnxiety}`;
}

function normalizeOutgoingVerdict(verdict) {
  const safetyLevel = VALID_SAFETY_LEVELS.has(String(verdict?.safetyLevel || '').toLowerCase())
    ? String(verdict.safetyLevel).toLowerCase()
    : 'yellow';
  const normalized = {
    ...verdict,
    safetyLevel,
    attachmentPattern: VALID_ATTACHMENT_PATTERNS.has(verdict?.attachmentPattern)
      ? verdict.attachmentPattern
      : 'SEC',
  };

  normalized.verdict = normalized.verdict || (safetyLevel === 'green' ? 'SEND' : safetyLevel === 'yellow' ? 'REWRITE' : 'HOLD');
  if (!['SEND', 'HOLD', 'REWRITE'].includes(normalized.verdict)) {
    normalized.verdict = 'HOLD';
  }
  normalized.pattern = normalized.pattern || normalized.attachmentPattern || 'SEC';
  normalized.feedback_text = normalized.feedback_text || normalized.reasoning || normalized.recipientRead || 'Pause and review before sending.';
  normalized.analysis = buildLegacyAnalysis(normalized);

  let themeCode = normalized.attachmentPattern;
  if (normalized.emotionalState === 'ANGRY') {
    themeCode = 'ANGRY';
  } else if (normalized.emotionalState === 'RISKY') {
    themeCode = 'RISKY';
  }
  normalized.themeCode = themeCode || 'SEC';

  return normalized;
}

function buildHistoryResponse(result) {
  return {
    ...result,
    entries: result.entries || [],
    verdicts: result.entries || [],
  };
}

function isDatabaseUnavailable(err) {
  return err?.code === 'DATABASE_UNAVAILABLE';
}

/**
 * Build a thread-context block for the AI prompt from the incoming threadHistory array.
 * Each item: { direction: 'sent'|'received', body: string, timestamp: number }
 * Cap at 30 messages, oldest first.
 */
function buildThreadContextBlock(threadHistory, cap = 30) {
  if (!Array.isArray(threadHistory) || threadHistory.length === 0) return '';
  const messages = threadHistory.slice(-cap);
  const lines = messages.map(m => {
    const speaker = m.direction === 'sent' ? 'USER' : 'THEM';
    return `[${speaker}] ${m.body}`;
  });
  return '\n\nFULL THREAD CONTEXT (oldest first, ' + cap + '-message cap):\n' + lines.join('\n');
}

router.post('/', async (req, res) => {
  try {
    const { outgoingMessage, message_text, threadHistory, userConditions, userId, user_id } = req.body || {};
    const rawMessage = typeof outgoingMessage === 'string' ? outgoingMessage : message_text;

    if (rawMessage === undefined || rawMessage === null) {
      return res.status(400).json({ error: 'message_text is required' });
    }

    const normalizedMessage = String(rawMessage).trim();
    if (!normalizedMessage) {
      return res.status(400).json({ error: 'message_text cannot be empty' });
    }

    const requestUserId = userId || user_id;
    let conditions = Array.isArray(userConditions) ? userConditions.filter(Boolean) : null;
    if ((!conditions || conditions.length === 0) && requestUserId) {
      try {
        conditions = await db.getUserConditions(requestUserId);
      } catch (err) {
        console.error('Error fetching user conditions:', err.message || err);
        conditions = [];
      }
    }

    const conditionsList = conditions && conditions.length > 0
      ? conditions.join(', ')
      : 'None specified';

    // Build the thread context block to append to the AI prompt
    const threadContextBlock = buildThreadContextBlock(threadHistory, 30);

    const systemPrompt = `You are HoldOff's Verdict AI. Analyze OUTGOING messages for HOW THEY WILL BE RECEIVED + emotional attachment pattern.

TASK:
1. Read the message as the RECIPIENT would read it (neutral, objective perspective)
2. Assess: Is this message likely to be well-received? Will it escalate? Is it landing safely?
3. Consider the user's conditions: [${conditionsList}]
4. If full thread context is provided, use it to identify escalation patterns, spiral signals, and relationship dynamics.

RESPOND WITH JSON ONLY:
{
  "verdict": "SEND" | "REWRITE" | "HOLD",
  "safetyLevel": "green" | "yellow" | "red" | "spiral",
  "attachmentPattern": "ANX" | "AVO" | "FA" | "SEC",
  "feedback_text": "<1-2 sentence plain-language read>",
  "recipientRead": "<how the recipient will likely read this>",
  "userAnxiety": "<what emotional state is driving this message>",
  "rewrite": "<optional improved version of the message, or empty string>",
  "reasoning": "<brief explanation>"
}`;

    const userContent = `User's message to send: "${normalizedMessage}"\n\nUser conditions: ${conditionsList}${threadContextBlock}`;

    let rawVerdict;
    try {
      rawVerdict = await callAI({ systemPrompt, userContent });
    } catch (aiErr) {
      console.error('[verdict] AI call failed:', aiErr.message || aiErr);
      rawVerdict = buildOutgoingVerdictFallback(normalizedMessage);
    }

    const verdict = normalizeOutgoingVerdict(rawVerdict);

    // Persist to verdict history if user is identified
    if (requestUserId) {
      try {
        await db.saveVerdict(requestUserId, normalizedMessage, verdict);
      } catch (dbErr) {
        if (!isDatabaseUnavailable(dbErr)) {
          console.error('[verdict] saveVerdict failed:', dbErr.message || dbErr);
        }
      }
    }

    return res.json(verdict);
  } catch (err) {
    console.error('[verdict] Unexpected error:', err.message || err);
    return res.status(500).json({ error: 'Verdict check failed. Try again.' });
  }
});

// GET /api/verdict/history
router.get('/history', requireAuth, validateHistoryQuery, async (req, res) => {
  try {
    const result = await getVerdictHistory(req.user.id, req.query);
    return res.json(buildHistoryResponse(result));
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return res.json(buildHistoryResponse({ entries: [] }));
    }
    console.error('[verdict] history error:', err.message || err);
    return res.status(500).json({ error: 'Could not load verdict history.' });
  }
});

// GET /api/verdict/streak
router.get('/streak', requireAuth, async (req, res) => {
  try {
    const result = await getStreak(req.user.id);
    return res.json(result);
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return res.json({ streak: 0, total: 0 });
    }
    console.error('[verdict] streak error:', err.message || err);
    return res.status(500).json({ error: 'Could not load streak.' });
  }
});

// GET /api/verdict/count/:userId
router.get('/count/:userId', requireAuth, async (req, res) => {
  try {
    const count = await getTotalVerdictCount(req.user.id);
    return res.json({ count });
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return res.json({ count: 0 });
    }
    console.error('[verdict] count error:', err.message || err);
    return res.status(500).json({ error: 'Could not load verdict count.' });
  }
});

module.exports = router;
