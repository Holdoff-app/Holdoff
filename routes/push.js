/**
 * Push notification routes — permission request, VAPID subscription, and reminder settings.
 * Owns: VAPID public key, push subscription registration, preference read/write.
 * Does NOT own: service worker push delivery, periodic scheduling (that's sw.js).
 *
 * Flow:
 *  1. Client GETs /api/push/vapid-key → receives public VAPID key
 *  2. Client calls navigator.push.subscribe() with the public key → gets PushSubscription
 *  3. Client POSTs subscription JSON to /api/push/subscribe
 *  4. Client sets reminder_time via /api/push/preferences (PATCH-style POST)
 *  5. Service worker uses periodic Sync API to check /api/push/due and show notifications
 */
const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { requireAuth } = require('../lib/auth');
const {
  upsertSubscription,
  getPreferences,
  updatePreferences,
  deleteSubscription,
  hasActiveSubscription,
} = require('../db/notifications');
const { isCapabilityAvailable } = require('../config/dependency-policy');

// VAPID keys — generate with: node -e "const {generateVAPIDKeys}=require('web-push');console.log(JSON.stringify(generateVAPIDKeys()))"
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT     || 'mailto:hello@shouldiholdoff.live';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[push] VAPID configured');
} else {
  console.warn('[push] VAPID keys not set — push notifications will fail in production');
}

const VALID_REMINDER_TIMES = ['9am', '8pm', '10pm'];

function ensurePushConfigured(res) {
  if (!isCapabilityAvailable('notifications.push')) {
    res.status(503).json({ error: 'Push notifications are temporarily unavailable' });
    return false;
  }
  return true;
}

// Rotating reminder copy — terse HoldOff voice
const REMINDER_COPY = [
  "You haven't checked in today. How's your last draft sitting?",
  "Three seconds. That's the whole thing.",
  "Still thinking about that text? Paste it in.",
  "Your grounded voice is available.",
];

function pickReminderCopy() {
  return REMINDER_COPY[Math.floor(Math.random() * REMINDER_COPY.length)];
}

// ---- GET /api/push/vapid-key ----
// No auth needed — public key, no PII.
router.get('/vapid-key', (_req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ key: VAPID_PUBLIC_KEY });
});

// ---- GET /api/push/preferences ----
router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const prefs = await getPreferences(req.user.id);
    if (!prefs) {
      return res.json({ enabled: false, reminder_time: '9am', quiet_hours: { start: '23:00', end: '08:00' }, has_subscription: false });
    }
    res.json({
      enabled: prefs.enabled,
      reminder_time: prefs.reminder_time || '9am',
      quiet_hours: prefs.quiet_hours || { start: '23:00', end: '08:00' },
      has_subscription: !!prefs.subscription,
    });
  } catch (err) {
    console.error('[push] GET /preferences error:', err.message);
    res.status(500).json({ error: 'Could not fetch preferences' });
  }
});

// ---- POST /api/push/subscribe ----
// Body: { subscription: PushSubscription JSON }
router.post('/subscribe', requireAuth, async (req, res) => {
  if (!ensurePushConfigured(res)) return;
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    await upsertSubscription(req.user.id, subscription);
    res.json({ ok: true });
  } catch (err) {
    console.error('[push] POST /subscribe error:', err.message);
    res.status(500).json({ error: 'Could not save subscription' });
  }
});

// ---- POST /api/push/preferences ----
// Body: { reminder_time?: string, enabled?: boolean, quiet_hours?: object }
router.post('/preferences', requireAuth, async (req, res) => {
  if (!ensurePushConfigured(res)) return;
  try {
    const { reminder_time, enabled, quiet_hours } = req.body || {};

    if (reminder_time && !VALID_REMINDER_TIMES.includes(reminder_time)) {
      return res.status(400).json({ error: `Invalid reminder_time. Use one of: ${VALID_REMINDER_TIMES.join(', ')}` });
    }
    if (quiet_hours) {
      if (!quiet_hours.start || !quiet_hours.end) {
        return res.status(400).json({ error: 'quiet_hours requires { start, end } in HH:MM format' });
      }
      const t = /^([01]\\d|2[0-3]):([0-5]\\d)$/;
      if (!t.test(quiet_hours.start) || !t.test(quiet_hours.end)) {
        return res.status(400).json({ error: 'quiet_hours values must be HH:MM (24h)' });
      }
    }

    // If enabling, require an active subscription
    if (enabled === true) {
      const has = await hasActiveSubscription(req.user.id);
      if (!has) {
        return res.status(400).json({ error: 'Push permission required before enabling reminders.' });
      }
    }

    const updated = await updatePreferences(req.user.id, {
      reminderTime: reminder_time,
      enabled: enabled,
      quietHours: quiet_hours,
    });

    res.json({ ok: true, preferences: updated });
  } catch (err) {
    console.error('[push] POST /preferences error:', err.message);
    res.status(500).json({ error: 'Could not update preferences' });
  }
});

// ---- DELETE /api/push/unsubscribe ----
router.delete('/unsubscribe', requireAuth, async (req, res) => {
  if (!ensurePushConfigured(res)) return;
  try {
    await deleteSubscription(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[push] DELETE /unsubscribe error:', err.message);
    res.status(500).json({ error: 'Could not unsubscribe' });
  }
});

// ---- GET /api/push/my-preferences ----
// Returns simplified prefs for the service worker to read (no auth required —
// cookies are passed automatically via credentials: 'include').
// The requireAuth middleware reads the JWT from the cookie.
router.get('/my-preferences', requireAuth, async (req, res) => {
  if (!ensurePushConfigured(res)) return;
  try {
    const prefs = await getPreferences(req.user.id);
    res.json({
      enabled:        prefs?.enabled        || false,
      reminder_time:   prefs?.reminder_time  || '9am',
      quiet_hours:     prefs?.quiet_hours    || { start: '23:00', end: '08:00' },
      has_subscription: !!prefs?.subscription,
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch preferences' });
  }
});

// ---- POST /api/push/send-test ----
// Sends a test notification to the user's saved subscription.
router.post('/send-test', requireAuth, async (req, res) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !isCapabilityAvailable('notifications.push')) {
    return res.status(503).json({ error: 'Push not configured' });
  }
  try {
    const prefs = await getPreferences(req.user.id);
    if (!prefs?.subscription) {
      return res.status(400).json({ error: 'No push subscription found. Enable push first.' });
    }

    const payload = JSON.stringify({
      title: 'HoldOff',
      body: 'Test notification — tap to open HoldOff.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'holdoff-test',
      data: { url: '/filter?focus=1' },
    });

    await webpush.sendNotification(prefs.subscription, payload);
    res.json({ ok: true });
  } catch (err) {
    console.error('[push] send-test error:', err.status, err.message);
    // If the subscription is gone or invalid, clean it up silently
    if (err.statusCode === 404 || err.statusCode === 410) {
      await deleteSubscription(req.user.id).catch(() => {});
      return res.status(400).json({ error: 'Subscription expired. Please re-enable in settings.' });
    }
    res.status(500).json({ error: 'Could not send test notification' });
  }
});

module.exports = router;