/**
 * Contact route — support message submission.
 * POST /api/contact — publicly accessible, forwards to Stacy via HoldOff email service.
 */
const express = require('express');
const router = express.Router();

const HOLDOFF_API_BASE_URL = process.env.HOLDOFF_API_BASE_URL;
const HOLDOFF_API_TOKEN = process.env.HOLDOFF_API_TOKEN || process.env.HOLDOFF_API_KEY;
const SUPPORT_EMAIL = 'company@shouldiholdoff.live';

/**
 * POST /api/contact
 * Body: { name, email, message }
 * Sends a support notification to the company inbox.
 */
router.post('/', async (req, res) => {
  const { name, email, message } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  if (!HOLDOFF_API_BASE_URL || !HOLDOFF_API_TOKEN) {
    return res.status(503).json({ error: 'Email service not configured.' });
  }

  try {
    const proxyUrl = `${HOLDOFF_API_BASE_URL}/api/proxy/email/send`;
    const resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HOLDOFF_API_TOKEN}`,
      },
      body: JSON.stringify({
        to: SUPPORT_EMAIL,
        subject: `Support: ${name.trim()}`,
        text: `${message.trim()}\n\nFrom: ${email.trim()} <${email.trim()}>`,
        from_name: name.trim(),
        reply_to: email.trim(),
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[contact] proxy error ${resp.status}: ${body}`);
      return res.status(502).json({ error: 'Failed to send message. Please try again.' });
    }

    res.json({ ok: true, message: 'Message sent.' });
  } catch (err) {
    console.error('[contact] send failed:', err.message);
    res.status(500).json({ error: 'Unexpected error. Please try again.' });
  }
});

module.exports = router;
