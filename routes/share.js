/**
 * Share routes.
 * Owns: POST /api/share/create, GET /api/share/og/:token (OG image).
 *   Also exports mountSharePages() for the share page view route (GET /share/:token).
 * Does NOT own: user auth, streak storage (client localStorage), AI analysis, DB pool.
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { createShareCard, getShareCardByToken } = require('../db/share-cards');
const { getCookieTokens } = require('../lib/auth');

/**
 * Curated pool of ~20 anonymized reframe lines, grouped by verdict type.
 * These are generic enough to never reveal message content — they describe
 * the emotional pattern, not the specific text. Privacy by design.
 */
const REFRAME_POOL = {
  HOLD: [
    'Sending this tonight would feel like relief. It wouldn\'t be.',
    'The urge to reach out is information. The message doesn\'t have to be.',
    'Midnight clarity is usually just exhaustion with a narrative.',
    'What feels urgent at 11pm is usually survivable by 9am.',
    'The relationship doesn\'t need this text. You need the relief. Those are different.',
    'Wanting a response badly enough to force one is the signal, not the message.',
    'Silence isn\'t rejection. It\'s silence. Let it be that.',
    'The grounded version of you already knows to wait.',
    'Three seconds of discomfort now saves three days of aftermath.',
    'Nothing you send right now will give you what you\'re actually looking for.',
  ],
  REWRITE: [
    'The original had the right feeling. The rewrite has the right words.',
    'Saying it clearly isn\'t cold — it\'s kind.',
    'Needy energy doesn\'t make people lean in. It makes them step back.',
    'The edited version says the same thing with less apology in it.',
    'Strong feelings are valid. Sending them unfiltered rarely helps.',
    'You can be honest without handing someone your anxiety.',
    'The rewrite doesn\'t change what you mean. It changes what they hear.',
    'Less subtext means less room for misreading.',
    'You know the difference between expressing and oversharing.',
    'The cleaner version of this message actually gets what you need.',
  ],
};

/** Pick a random reframe line for the given verdict type. */
function pickReframe(verdictType) {
  const pool = REFRAME_POOL[verdictType] || REFRAME_POOL.HOLD;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Cryptographically-adequate nanoid-style token using Node crypto — no extra dependency. */
function generateToken(len = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

/**
 * POST /api/share/create
 * Body: { streak_count, verdict_type, pattern_name? }
 * Returns: { token, url, reframeLine }
 * Attribution: reads JWT cookie to generate a ref_token tied to the sharing user's referral system.
 */
router.post('/create', async (req, res) => {
  try {
    const { streak_count, verdict_type, pattern_name } = req.body;

    // Validate minimal required fields
    const count = parseInt(streak_count, 10);
    if (isNaN(count) || count < 0) {
      return res.status(400).json({ error: 'streak_count must be a non-negative integer' });
    }
    const verdict = (verdict_type || '').toUpperCase().trim();
    if (!['HOLD', 'REWRITE', 'SEND'].includes(verdict)) {
      return res.status(400).json({ error: 'verdict_type must be HOLD, REWRITE, or SEND' });
    }

    // Derive referral attribution token from logged-in user email (stable sha256 prefix)
    let refToken = null;
    try {
      const tokens = getCookieTokens(req);
      const jwtPayload = tokens.accessPayload || tokens.refreshPayload;
      if (jwtPayload?.email) {
        refToken = crypto
          .createHash('sha256')
          .update(jwtPayload.email.toLowerCase().trim())
          .digest('hex')
          .slice(0, 12);
      }
    } catch (_) {}

    const token = generateToken(10);
    const reframeLine = pickReframe(verdict);

    const card = await createShareCard({
      token,
      streak_count: count,
      verdict_type: verdict,
      pattern_name: pattern_name ? String(pattern_name).slice(0, 200) : null,
      reframe_line: reframeLine,
      ref_token: refToken,
    });

    const baseUrl = process.env.APP_URL || `https://${req.headers.host}`;
    const shareUrl = refToken
      ? `${baseUrl}/share/${card.token}?ref=${refToken}`
      : `${baseUrl}/share/${card.token}`;

    // Analytics event
    console.log(JSON.stringify({ event: 'share_card_created', token: card.token, streak_count: count, verdict_type: verdict }));

    return res.json({ token: card.token, url: shareUrl, reframeLine });
  } catch (err) {
    console.error('[share] create error:', err?.message);
    return res.status(500).json({ error: 'Could not create share card' });
  }
});

/**
 * GET /api/share/og/:token
 * Server-rendered SVG OG image for social unfurls (Twitter/iMessage/Reddit).
 */
router.get('/og/:token', async (req, res) => {
  try {
    const card = await getShareCardByToken(req.params.token);
    if (!card) return res.status(404).send('Not found.');

    const n = card.streak_count;
    const patternLine = card.pattern_name
      ? `Last one: "${card.pattern_name.slice(0, 60)}"`
      : (card.verdict_type === 'REWRITE' ? 'Last one: rewritten before sending' : 'Last one: held back entirely');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1A1410;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2E1F14;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="600" y="240" font-family="Georgia, serif" font-size="180" font-weight="700"
        fill="#C97B5D" text-anchor="middle" dominant-baseline="middle">${n}</text>
  <text x="600" y="350" font-family="Georgia, serif" font-size="52" font-weight="400"
        fill="#FAF6F0" text-anchor="middle">fires I didn&#x2019;t start.</text>
  <text x="600" y="420" font-family="Arial, sans-serif" font-size="26" font-weight="300"
        fill="#9A8F8A" text-anchor="middle">${patternLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</text>
  <text x="600" y="570" font-family="Georgia, serif" font-size="28" font-weight="400"
        fill="#C97B5D" text-anchor="middle">HoldOff — shouldiholdoff.live</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(svg);
  } catch (err) {
    console.error('[share] og error:', err?.message);
    res.status(500).send('Error generating image.');
  }
});

/**
 * mountSharePages(app) — attaches GET /share/:token to the Express app.
 * Called from server.js after static middleware. Uses app.get() because
 * share page lives at root-level URL, not under /api/share.
 */
function mountSharePages(app) {
  app.get('/share/:token', async (req, res) => {
    try {
      const card = await getShareCardByToken(req.params.token);
      if (!card) return res.status(404).send('Share card not found.');

      const baseUrl = process.env.APP_URL || `https://${req.headers.host}`;
      const pageUrl = `${baseUrl}/share/${card.token}`;

      let ogDescription = `They held off ${card.streak_count} time${card.streak_count !== 1 ? 's' : ''}.`;
      if (card.pattern_name) ogDescription += ` Last one: "${card.pattern_name}".`;
      ogDescription += ' HoldOff — AI that intercepts the texts you\'ll regret.';

      console.log(JSON.stringify({ event: 'share_card_viewed', token: card.token, view_count: card.view_count }));

      res.render('share', {
        streakCount: card.streak_count,
        verdictType: card.verdict_type,
        patternName: card.pattern_name,
        reframeLine: card.reframe_line || null,
        refToken: card.ref_token || null,
        pageUrl,
        ogDescription,
      });
    } catch (err) {
      console.error('[share] page error:', err?.message);
      res.status(500).send('Something went wrong.');
    }
  });
}

module.exports = router;
module.exports.mountSharePages = mountSharePages;
