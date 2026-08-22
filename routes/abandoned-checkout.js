/**
 * Abandoned checkout route group.
 * Owns: unsubscribe endpoint for abandoned-checkout recovery emails.
 * Does NOT own: Stripe webhook handling (routes/stripe-webhook.js),
 *   email sending (jobs/abandoned-checkout.js), admin metrics (routes/admin.js).
 */
const express = require('express');
const router = express.Router();
const { unsubscribeByToken } = require('../db/abandoned-checkouts');

/**
 * GET /api/abandoned-checkout/unsub?token=<token>
 * One-click unsubscribe from abandoned-checkout recovery emails.
 * Returns a plain confirmation page — no login required.
 */
router.get('/unsub', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send('<p style="font-family:sans-serif;padding:40px">Invalid unsubscribe link.</p>');
  }

  try {
    const email = await unsubscribeByToken(token);
    if (!email) {
      // Token not found — already unsubscribed or invalid
      return res.send(`
        <html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
        <body style="font-family:-apple-system,sans-serif;padding:60px;max-width:480px;margin:0 auto;background:#0f0f0f;color:#cccccc;">
          <h2 style="color:#ffffff">Already unsubscribed</h2>
          <p>This link has already been used or is invalid. You won't receive more abandoned checkout emails from HoldOff.</p>
        </body></html>`);
    }
    console.log(`[abandoned-checkout] unsubscribed ${email} via token`);
    return res.send(`
      <html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
      <body style="font-family:-apple-system,sans-serif;padding:60px;max-width:480px;margin:0 auto;background:#0f0f0f;color:#cccccc;">
        <h2 style="color:#ffffff">You're unsubscribed.</h2>
        <p>We've removed <strong>${email}</strong> from abandoned checkout reminders. You won't hear from us again on this topic.</p>
        <p><a href="https://shouldiholdoff.live/filter" style="color:#8b5cf6">Back to HoldOff →</a></p>
      </body></html>`);
  } catch (err) {
    console.error('[abandoned-checkout] unsub error:', err.message);
    return res.status(500).send('<p style="font-family:sans-serif;padding:40px">Something went wrong. Please try again.</p>');
  }
});

module.exports = router;
