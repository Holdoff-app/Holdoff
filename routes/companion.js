/**
 * AI Companion chat route
 *
 * Two souls (Sadie, Dan) × four canonical attachment styles
 * (secure, anxious, dismissive_avoidant, fearful_avoidant).
 * Same style set for both souls, soul-specific overlays.
 */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../lib/auth');
const {
  buildCompanionPrompt,
  listSouls,
  listAttachmentStyles,
  listCompanionVariants,
  STYLE_ORDER,
} = require('../lib/companion-ai');
const { buildCompanionFallback } = require('../services/resilient-ai');
const { callAI } = require('../services/ai-provider');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages. Please slow down.', code: 'RATE_LIMITED' },
});

// Legacy → canonical
function canonicalSoul(name) {
  if (!name) return null;
  const n = String(name).trim();
  if (n === 'Stacy') return 'Sadie';
  if (n === 'Danny') return 'Dan';
  if (n === 'Sadie' || n === 'Dan') return n;
  return null;
}

// GET /api/companion/souls — list available souls
router.get('/souls', (_req, res) => {
  res.json({ souls: listSouls() });
});

// GET /api/companion/styles?soul=Sadie — list the 4 styles with soul-specific blurbs
router.get('/styles', (req, res) => {
  const soul = canonicalSoul(req.query.soul);
  res.json({ soul, styles: listAttachmentStyles(soul) });
});

// GET /api/companion/variants — all 8 (4 styles × 2 souls)
router.get('/variants', (_req, res) => {
  res.json({ variants: listCompanionVariants() });
});

// POST /api/companion/chat — chat with a soul in a chosen attachment style
router.post('/chat', chatLimiter, requireAuth, async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { characterName, soulName, message, conversationHistory, attachmentStyle } = req.body;

  const soul = canonicalSoul(soulName || characterName);
  if (!soul) {
    return res.status(400).json({ error: 'Invalid soul (use Sadie or Dan)' });
  }
  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  // If a style was provided, make sure it's one of the canonical 4.
  let style = attachmentStyle;
  if (style && !STYLE_ORDER.includes(style)) {
    style = undefined;
  }

  try {
    const prompt = await buildCompanionPrompt(
      soul,
      message,
      conversationHistory || [],
      user,
      { attachmentStyle: style }
    );

    // Build full message history for companion
    const messages = [
      ...prompt.conversationMessages.map(m => m.role === 'system' ? '' : m.content).filter(Boolean),
      message
    ].join('\n\n');

    const aiResult = await callAI({
      systemPrompt: prompt.system,
      userContent: message,
      maxTokens: 1024
    });

    if (!aiResult) {
      const fallback = buildCompanionFallback({ soul: prompt.soul.key, style: prompt.style.key, message });
      return res.json({
        ...fallback,
        soul: prompt.soul.key,
        style: prompt.style.key,
        styleLabel: prompt.style.label,
      });
    }

    return res.json({
      reply: aiResult.content,
      soul: prompt.soul.key,
      style: prompt.style.key,
      styleLabel: prompt.style.label,
      source: aiResult.source,
    });
  } catch (error) {
    console.error('[companion] Error:', error.message);
    const fallback = buildCompanionFallback({ soul, style, message });
    return res.status(200).json({
      ...fallback,
      soul: soul || 'Sadie',
      style: style || null,
      styleLabel: style || null,
    });
  }
});

module.exports = router;

