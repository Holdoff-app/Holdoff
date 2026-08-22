/**
 * Exit-intent event DB queries.
 * Owns: exit_intent_events table reads/writes for conversion funnel tracking.
 * Does NOT own: detox subscriber logic, email sending, route handling.
 */
const { pool } = require('./index');
const Sentry = require('@sentry/node');

/**
 * Log a single exit-intent event (modal_shown, modal_submitted, modal_dismissed).
 */
async function logExitIntentEvent({ event_type, email, device_id }) {
  try {
    await pool.query(
      `INSERT INTO exit_intent_events (event_type, email, device_id)
       VALUES ($1, $2, $3)`,
      [event_type, email || null, device_id || null]
    );
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Count events by type in the last N days (for admin metrics).
 * Returns { modal_shown, modal_submitted, modal_dismissed, conversion_rate }.
 */
async function getExitIntentMetrics(days = 7) {
  const result = await pool.query(
    `SELECT event_type, COUNT(*)::int AS count
     FROM exit_intent_events
     WHERE created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY event_type`,
    [days]
  );
  const counts = { modal_shown: 0, modal_submitted: 0, modal_dismissed: 0 };
  for (const row of result.rows) {
    if (counts.hasOwnProperty(row.event_type)) {
      counts[row.event_type] = row.count;
    }
  }
  const rate = counts.modal_shown > 0
    ? ((counts.modal_submitted / counts.modal_shown) * 100).toFixed(1)
    : '0.0';
  return { ...counts, conversion_rate: rate + '%', days };
}

/**
 * Count detox Day 5 referral CTA clicks in the last N days.
 * Stored as event_type = 'referral_click_detox_day5' in exit_intent_events.
 */
async function getDetoxDay5Clicks(days = 7) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM exit_intent_events
     WHERE event_type = 'referral_click_detox_day5'
       AND created_at >= NOW() - ($1 || ' days')::interval`,
    [days]
  );
  return { count: result.rows[0]?.count || 0, days };
}

/**
 * Welcome email activation metrics for the last N days.
 * Counts welcome_sent, welcome_opened, welcome_clicked, welcome_to_first_verdict events.
 * All stored in exit_intent_events as event_type strings.
 */
async function getWelcomeMetrics(days = 7) {
  const result = await pool.query(
    `SELECT event_type, COUNT(*)::int AS count
     FROM exit_intent_events
     WHERE event_type IN ('welcome_sent','welcome_opened','welcome_clicked','welcome_to_first_verdict')
       AND created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY event_type`,
    [days]
  );
  const counts = {
    welcome_sent: 0,
    welcome_opened: 0,
    welcome_clicked: 0,
    welcome_to_first_verdict: 0,
  };
  for (const row of result.rows) {
    if (Object.prototype.hasOwnProperty.call(counts, row.event_type)) {
      counts[row.event_type] = row.count;
    }
  }
  return { ...counts, days };
}

/**
 * Win-back email funnel metrics for the last N days.
 * Counts winback_sent, winback_clicked, winback_converted events from exit_intent_events.
 */
async function getWinbackMetrics(days = 14) {
  const result = await pool.query(
    `SELECT event_type, COUNT(*)::int AS count
     FROM exit_intent_events
     WHERE event_type IN ('winback_sent','winback_clicked','winback_converted')
       AND created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY event_type`,
    [days]
  );
  const counts = { winback_sent: 0, winback_clicked: 0, winback_converted: 0 };
  for (const row of result.rows) {
    if (Object.prototype.hasOwnProperty.call(counts, row.event_type)) {
      counts[row.event_type] = row.count;
    }
  }
  return { ...counts, days };
}

/**
 * CashApp Pay checkout funnel metrics for the last N days.
 * Counts cashapp_checkout_started, cashapp_checkout_completed, cashapp_checkout_failed
 * events from exit_intent_events.
 */
async function getCashAppMetrics(days = 7) {
  const result = await pool.query(
    `SELECT event_type, COUNT(*)::int AS count
     FROM exit_intent_events
     WHERE event_type IN ('cashapp_checkout_started','cashapp_checkout_completed','cashapp_checkout_failed')
       AND created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY event_type`,
    [days]
  );
  const counts = { cashapp_checkout_started: 0, cashapp_checkout_completed: 0, cashapp_checkout_failed: 0 };
  for (const row of result.rows) {
    if (Object.prototype.hasOwnProperty.call(counts, row.event_type)) {
      counts[row.event_type] = row.count;
    }
  }
  const ctr = counts.cashapp_checkout_started > 0
    ? ((counts.cashapp_checkout_completed / counts.cashapp_checkout_started) * 100).toFixed(1)
    : '0.0';
  const convRate = counts.cashapp_checkout_started > 0
    ? (((counts.cashapp_checkout_completed + counts.cashapp_checkout_failed) / counts.cashapp_checkout_started) * 100).toFixed(1)
    : '0.0';
  return { ...counts, ctr: ctr + '%', conversion_rate: convRate + '%', days };
}

module.exports = {
  logExitIntentEvent,
  getExitIntentMetrics,
  getDetoxDay5Clicks,
  getWelcomeMetrics,
  getWinbackMetrics,
  getCashAppMetrics,
};
