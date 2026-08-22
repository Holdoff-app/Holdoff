/**
 * Outreach route group — creator/influencer cold outreach emails.
 * Owns: POST /api/outreach/send (internal trigger for creator emails).
 * Does NOT own: waitlist, nurture sequences, auth.
 *
 * Protected by OUTREACH_TOKEN env var. Used by HoldOff agents to send
 * cold outreach emails via the HoldOff email service.
 */
const express = require('express');
const router = express.Router();

const EMAIL_PROXY_URL = process.env.HOLDOFF_EMAIL_PROXY_URL;
const API_TOKEN = process.env.HOLDOFF_API_TOKEN || process.env.HOLDOFF_API_KEY;
const OUTREACH_TOKEN = process.env.OUTREACH_TOKEN;

function requireOutreachToken(req, res, next) {
  if (!OUTREACH_TOKEN) {
    return res.status(503).json({ error: 'Outreach not configured.' });
  }
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${OUTREACH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

/**
 * POST /api/outreach/send
 * Body: { to, subject, text, html?, fromName? }
 * Sends a single cold outreach email via the HoldOff email service.
 */
router.post('/send', requireOutreachToken, async (req, res) => {
  const { to, subject, text, html, fromName } = req.body || {};

  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'to, subject, and text are required.' });
  }

  if (!EMAIL_PROXY_URL || !API_TOKEN) {
    return res.status(503).json({ error: 'Email proxy not configured.' });
  }

  try {
    const resp = await fetch(EMAIL_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        to,
        subject,
        text,
        html: html || undefined,
        from_name: fromName || 'HoldOff',
        reply_to: 'holdoff@shouldiholdoff.live',
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[outreach] proxy error ${resp.status}: ${body}`);
      return res.status(502).json({ error: `Proxy returned ${resp.status}`, detail: body });
    }

    const data = await resp.json().catch(() => ({}));
    console.log(`[outreach] Sent to ${to} — messageId: ${data?.id || 'unknown'}`);
    res.json({ ok: true, to, messageId: data?.id || null });
  } catch (err) {
    console.error(`[outreach] send failed for ${to}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;