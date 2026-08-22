/**
 * Detox route group. Owns: POST /api/detox/signup, GET /api/detox/unsubscribe,
 *   POST /api/detox/exit-intent-event, POST /api/detox/exit-intent-signup,
 *   POST /api/detox/referral-click (detox_day5 referral CTA click tracking).
 * Does NOT own: user auth, Stripe, general waitlist.
 */
const express = require('express');
const router = express.Router();
const { addDetoxSubscriber, unsubscribeDetox } = require('../db/detox');
const { sendEmail } = require('../services/email');
const { day0 } = require('../services/detox-emails');
const { logExitIntentEvent } = require('../db/exit-intent');

// POST /api/detox/signup
router.post('/signup', async (req, res) => {
  const { email } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const row = await addDetoxSubscriber(email);
    if (!row) {
      // Already subscribed — still return 200
      return res.json({ ok: true, already: true });
    }

    // Send Day 0 immediately — non-blocking
    (async () => {
      try {
        const { subject, html, text } = day0({ email: row.email });
        await sendEmail({ to: row.email, subject, html, text });
        console.log(`[detox] day0 sent to ${row.email}`);
      } catch (err) {
        console.error(`[detox] day0 FAILED for ${row.email}: ${err.message}`);
      }
    })();

    // Fire Meta Pixel Lead event is handled client-side
    return res.json({ ok: true });
  } catch (err) {
    console.error('[detox] signup error:', err.message);
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

// POST /api/detox/subscribe — alias for /signup used by SEO static pages
router.post('/subscribe', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  try {
    const row = await addDetoxSubscriber(email);
    if (!row) return res.json({ ok: true, already_subscribed: true });
    (async () => {
      try {
        const { subject, html, text } = day0({ email: row.email });
        await sendEmail({ to: row.email, subject, html, text });
      } catch (err) {
        console.error(`[detox] subscribe day0 FAILED for ${row.email}: ${err.message}`);
      }
    })();
    return res.json({ ok: true });
  } catch (err) {
    console.error('[detox] subscribe error:', err.message);
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET /api/detox/unsubscribe — one-click unsubscribe from drip emails
router.get('/unsubscribe', async (req, res) => {
  const { email } = req.query || {};
  if (email) {
    try {
      await unsubscribeDetox(email);
    } catch (err) {
      console.error('[detox] unsubscribe error:', err.message);
    }
  }
  res.send(`
    <html><body style="font-family:Georgia,serif;max-width:480px;margin:4rem auto;color:#2A2522;text-align:center;">
      <h2 style="font-weight:600;letter-spacing:-0.02em;">You're off the list.</h2>
      <p style="color:#8A7F79;">No more detox emails. We won't email you again.</p>
      <p><a href="/" style="color:#C97B5D;">Back to HoldOff →</a></p>
    </body></html>
  `);
});

// POST /api/detox/exit-intent-event — logs modal_shown, modal_submitted, modal_dismissed
router.post('/exit-intent-event', async (req, res) => {
  const { event_type, device_id } = req.body || {};
  const VALID = ['modal_shown', 'modal_submitted', 'modal_dismissed'];
  if (!event_type || !VALID.includes(event_type)) {
    return res.status(400).json({ error: 'Invalid event_type' });
  }
  try {
    await logExitIntentEvent({ event_type, device_id: device_id || null });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[detox] exit-intent-event error:', err.message);
    return res.status(500).json({ error: 'log failed' });
  }
});

// POST /api/detox/exit-intent-signup — subscribe from exit-intent modal, send day0 immediately
// Reuses existing detox infrastructure; logs modal_submitted event.
router.post('/exit-intent-signup', async (req, res) => {
  const { email, device_id } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    // Log submission event first (non-fatal if it fails)
    logExitIntentEvent({ event_type: 'modal_submitted', email, device_id: device_id || null }).catch(() => {});

    const row = await addDetoxSubscriber(email);
    // row === null means already subscribed — still return ok
    if (!row) {
      return res.json({ ok: true, already: true });
    }

    // Send Day 0 immediately — non-blocking
    (async () => {
      try {
        const { subject, html, text } = day0({ email: row.email });
        await sendEmail({ to: row.email, subject, html, text });
        console.log(`[detox] exit-intent day0 sent to ${row.email}`);
      } catch (err) {
        console.error(`[detox] exit-intent day0 FAILED for ${row.email}: ${err.message}`);
      }
    })();

    return res.json({ ok: true });
  } catch (err) {
    console.error('[detox] exit-intent-signup error:', err.message);
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

// POST /api/detox/referral-click — log detox_day5 referral CTA click for metrics
router.post('/referral-click', async (req, res) => {
  const { source } = req.body || {};
  const VALID_SOURCES = ['detox_day5'];
  if (!source || !VALID_SOURCES.includes(source)) {
    return res.status(400).json({ error: 'Invalid source' });
  }
  try {
    // Reuse exit_intent_events table with a dedicated event_type
    await logExitIntentEvent({ event_type: `referral_click_${source}`, device_id: null });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[detox] referral-click error:', err.message);
    return res.status(500).json({ error: 'log failed' });
  }
});

module.exports = router;
