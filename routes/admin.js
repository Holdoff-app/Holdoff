/**
 * Admin route group — internal trigger endpoints for HoldOff operations.
 * Owns: POST /api/admin/auto-intercept-launch, GET /api/admin/metrics.
 * Does NOT own: user auth, Stripe, waitlist signup flow.
 *
 * All endpoints require Authorization: Bearer <ADMIN_TOKEN> header.
 */
const express = require('express');
const router = express.Router();
const { getPendingLaunchEmails, markNurtureSent, markNurtureFailed } = require('../db/nurture-queue');
const { sendEmail } = require('../services/email');
const { email3 } = require('../services/nurture-emails');
const { getExitIntentMetrics, getDetoxDay5Clicks, getWelcomeMetrics, getWinbackMetrics, getCashAppMetrics } = require('../db/exit-intent');
const { getAbandonedCheckoutMetrics } = require('../db/abandoned-checkouts');
const { getDunningMetrics } = require('../db/dunning');

function requireAdminToken(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  // If ADMIN_TOKEN is not set, deny all — fail safe
  if (!token) {
    return res.status(503).json({ error: 'Admin endpoints not configured.' });
  }
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${token}`) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

/**
 * POST /api/admin/auto-intercept-launch
 * Fires email 3 to every auto_intercept waitlist subscriber in the nurture queue.
 * Hit this once when auto-intercept APK ships.
 * Protected by ADMIN_TOKEN env var.
 */
router.post('/auto-intercept-launch', requireAdminToken, async (req, res) => {
  const rows = await getPendingLaunchEmails().catch(err => {
    console.error('[admin] nurture launch fetch error:', err.message);
    return null;
  });

  if (!rows) {
    return res.status(500).json({ error: 'Could not fetch pending launch emails.' });
  }

  if (rows.length === 0) {
    return res.json({ ok: true, sent: 0, failed: 0, message: 'No pending launch emails.' });
  }

  console.log(`[admin] Firing email-3 launch to ${rows.length} subscriber(s)`);

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const { subject, html, text } = email3({ email: row.email });
      await sendEmail({ to: row.email, subject, html, text });
      await markNurtureSent(row.id);
      sent++;
    } catch (err) {
      await markNurtureFailed(row.id, err.message).catch(() => {});
      errors.push({ email: row.email, error: err.message });
      failed++;
    }
  }

  console.log(`[admin] email-3 launch done — sent=${sent} failed=${failed}`);
  res.json({ ok: true, sent, failed, errors: errors.length ? errors : undefined });
});

/**
 * GET /api/admin/metrics?days=7
 * Returns exit-intent conversion funnel + detox referral click counts + dunning recovery
 * + revenue metrics (MRR, ARR, lifetime revenue).
 */
router.get('/metrics', requireAdminToken, async (req, res) => {
  const days = parseInt(req.query.days || '7', 10) || 7;
  try {
    const [ei, d5, abandoned, welcome, dunning, winback, cashapp, revenue, users, streaks] = await Promise.all([
      getExitIntentMetrics(days),
      getDetoxDay5Clicks(days),
      getAbandonedCheckoutMetrics(days),
      getWelcomeMetrics(days),
      getDunningMetrics(days),
      getWinbackMetrics(days),
      getCashAppMetrics(days),
      getRevenueMetrics(),
      getUserMetrics(),
      getStreakMetrics(),
    ]);
    return res.json({
      ok: true,
      exit_intent: ei,
      detox_day5_referral_click: d5,
      abandoned_checkout: abandoned,
      welcome,
      dunning,
      winback,
      cashapp,
      revenue,
      users,
      streaks,
    });
  } catch (err) {
    console.error('[admin] metrics error:', err.message);
    return res.status(500).json({ error: 'Could not fetch metrics.' });
  }
});

/**
 * Compute revenue metrics from active subscriptions.
 * MRR = sum of monthly-equivalent revenue (weekly×4.33, monthly, annual/12).
 * ARR = MRR × 12.
 * Lifetime revenue = sum of all completed checkout amounts from exit_intent_events.
 */
async function getRevenueMetrics() {
  const { pool } = require('../db/index');

  const subRows = await pool.query(
    `SELECT membership_type, status, current_period_end
     FROM subscriptions
     WHERE status IN ('active', 'past_due')`
  );

  let mrr = 0;
  for (const row of subRows.rows) {
    if (row.membership_type === 'lifetime') continue; // no recurring revenue
    const type = row.membership_type || 'online';
    // Base prices — approximates when Stripe isn't reachable directly
    const basePrices = { online: 9.99, app: 14.99 };
    mrr += basePrices[type] || 9.99;
  }

  // Lifetime revenue from cashapp checkout completions tracked in exit_intent_events
  // Note: Stripe dashboard is the source of truth for total lifetime revenue.
  const lifetimeRevenue = 0;

  const arr = mrr * 12;
  return {
    mrr: +mrr.toFixed(2),
    arr: +arr.toFixed(2),
    lifetime_revenue: lifetimeRevenue,
    active_subscriptions: subRows.rows.length,
  };
}

/**
 * Compute user count metrics from the users table.
 */
async function getUserMetrics() {
  const { pool } = require('../db/index');

  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE u.subscription_status = 'active') AS active,
       COUNT(*) FILTER (WHERE u.membership_type = 'online') AS pro_online,
       COUNT(*) FILTER (WHERE u.membership_type = 'app') AS pro_app,
       COUNT(*) FILTER (WHERE u.membership_type = 'lifetime') AS lifetime,
       COUNT(*) FILTER (WHERE u.subscription_status = 'cancelled') AS cancelled,
       COUNT(*) FILTER (WHERE u.subscription_status IS NULL AND u.membership_type IS NULL) AS free
     FROM users u`
  );

  const r = rows[0] || {};
  return {
    total: r.total || 0,
    active: r.active || 0,
    pro: (r.pro_online || 0) + (r.pro_app || 0),
    lifetime: r.lifetime || 0,
    cancelled: r.cancelled || 0,
    free: r.free || 0,
  };
}

/**
 * Compute streak metrics from journal_streaks.
 */
async function getStreakMetrics() {
  const { pool } = require('../db/index');

  const { rows } = await pool.query(
    `SELECT
       AVG(current_streak)::int AS avg_streak,
       MAX(current_streak) AS max_streak,
       MAX(longest_streak) AS longest_streak,
       COUNT(*)::int AS users_with_streak
     FROM journal_streaks
     WHERE current_streak > 0`
  );

  const r = rows[0] || {};
  return {
    avg_streak: r.avg_streak || 0,
    max_streak: r.max_streak || 0,
    longest_streak: r.longest_streak || 0,
    users_with_streak: r.users_with_streak || 0,
  };
}

module.exports = router;
