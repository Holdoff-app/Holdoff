/**
 * Waitlist route group. Owns: POST /api/waitlist/join, GET /api/waitlist/unsubscribe.
 * Does NOT own: user auth, Stripe, Meta Pixel events.
 */
const express = require('express');
const router = express.Router();
const { addToWaitlist } = require('../db/waitlist');
const { enqueueNurtureEmail } = require('../db/nurture-queue');
const { sendEmail } = require('../services/email');
const { email1 } = require('../services/nurture-emails');

const EMAIL_PROXY_URL = process.env.HOLDOFF_EMAIL_PROXY_URL;
const API_TOKEN = process.env.HOLDOFF_API_TOKEN || process.env.HOLDOFF_API_KEY;

/**
 * Send the general (non-auto_intercept) waitlist confirmation email via the email proxy.
 * Falls back to a no-op when proxy is not configured.
 */
async function sendGeneralConfirmationEmail(email) {
  if (!EMAIL_PROXY_URL || !API_TOKEN) {
    console.warn('[waitlist] Email proxy not configured — skipping general confirmation email');
    return;
  }

  const unsubUrl = `https://shouldiholdoff.live/api/waitlist/unsubscribe?email=${encodeURIComponent(email)}`;
  const html = `
<div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2A2522; line-height: 1.7;">
  <h2 style="font-size: 1.5rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 1rem;">You're on the HoldOff list.</h2>
  <p style="margin-bottom: 1rem;">The iOS app doesn't exist yet. That's the point — you're here before the thing exists, which means you already know you need it.</p>
  <p style="margin-bottom: 1rem;">When it drops, you'll be first. We'll send one email. No drip sequences, no "just checking in," no re-engagement campaigns at 7 AM.</p>
  <p style="margin-bottom: 1.5rem; font-style: italic; color: #C97B5D;">Don't send it yet. — HoldOff</p>
  <hr style="border: none; border-top: 1px solid #E5DED4; margin: 1.5rem 0;" />
  <p style="font-size: 0.8rem; color: #8A7F79;">You're receiving this because you joined the HoldOff waitlist. <a href="${unsubUrl}" style="color: #8A7F79;">Unsubscribe</a>.</p>
</div>`.trim();

  try {
    const resp = await fetch(EMAIL_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        to: email,
        subject: "You're on the HoldOff list",
        html,
        from_name: 'HoldOff',
        reply_to: 'holdoff@shouldiholdoff.live',
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('[waitlist] Email proxy error:', resp.status, text);
    }
  } catch (err) {
    // Non-fatal — user is already on the list
    console.error('[waitlist] General confirmation email failed:', err.message);
  }
}

/**
 * Send email 1 of the auto_intercept nurture sequence (immediate) and
 * enqueue email 2 (+72hr) and email 3 (undated — fires on launch trigger).
 */
async function startAutoInterceptSequence(email) {
  // Email 1 — send now via Resend
  try {
    const { subject, html, text } = email1({ email });
    await sendEmail({ to: email, subject, html, text });
    console.log(`[waitlist] auto_intercept email-1 sent to ${email}`);
  } catch (err) {
    // Non-fatal — user is on list regardless
    console.error(`[waitlist] auto_intercept email-1 FAILED for ${email}: ${err.message}`);
  }

  // Email 2 — enqueue for 72hr from now
  const email2At = new Date(Date.now() + 72 * 60 * 60 * 1000);
  await enqueueNurtureEmail(email, 2, email2At).catch(err => {
    console.error(`[waitlist] Failed to enqueue email-2 for ${email}: ${err.message}`);
  });

  // Email 3 — enqueue with a far-future date; it's sent when the admin trigger fires
  // The admin endpoint sends it regardless of scheduled_at via getPendingLaunchEmails().
  // We schedule it 10 years out so it never auto-fires from the cron.
  const email3At = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);
  await enqueueNurtureEmail(email, 3, email3At).catch(err => {
    console.error(`[waitlist] Failed to enqueue email-3 for ${email}: ${err.message}`);
  });
}

// POST /api/waitlist/join
router.post('/join', async (req, res) => {
  const { email, source } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const row = await addToWaitlist(email, source || 'landing');
    if (!row) {
      // Already on the list — still return 200, don't expose internals
      return res.json({ ok: true, already: true });
    }

    // Fire confirmation async — don't block the response
    const src = source || 'landing';
    if (src === 'auto_intercept') {
      // Start the 3-email nurture sequence
      startAutoInterceptSequence(email);
    } else {
      sendGeneralConfirmationEmail(email);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[waitlist] join error:', err.message);
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET /api/waitlist/unsubscribe — one-click unsubscribe link from confirmation email
router.get('/unsubscribe', async (req, res) => {
  // We don't delete — just confirm receipt. No table change needed since
  // waitlist is pre-launch; actual unsubscribe management is a future feature.
  res.send(`
    <html><body style="font-family:Georgia,serif;max-width:480px;margin:4rem auto;color:#2A2522;text-align:center;">
      <h2 style="font-weight:600;letter-spacing:-0.02em;">You're off the list.</h2>
      <p style="color:#8A7F79;">We won't email you again.</p>
    </body></html>
  `);
});

module.exports = router;
