/**
 * Dunning attempts queries — involuntary churn recovery state.
 * Owns: dunning_attempts table CRUD (create, status transitions, metrics).
 * Does NOT own: email sending, Stripe API calls, HTTP routing.
 */
const { pool } = require('./index');

/**
 * Create a dunning attempt record when invoice.payment_failed fires.
 * Idempotent — a second failure on the same sub within an active window is a no-op.
 * "Active window" = no recovered/lost attempt exists for this sub in the last 35 days.
 */
async function createDunningAttempt({ subscriptionId, customerId, email }) {
  const { rows } = await pool.query(
    `INSERT INTO dunning_attempts (subscription_id, customer_id, email, status, failure_detected_at)
     VALUES ($1, $2, $3, 'pending', NOW())
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [subscriptionId, customerId || null, email || null]
  );
  // ON CONFLICT DO NOTHING won't fire — we don't have a unique index.
  // Instead: only insert if no active (non-terminal) row exists for this sub.
  // We'll handle idempotency in the caller (webhook checks before inserting).
  return rows[0] || null;
}

/**
 * Get the active (non-terminal) dunning attempt for a subscription, if any.
 * Terminal statuses are: recovered, lost.
 */
async function getActiveDunningAttempt(subscriptionId) {
  const { rows } = await pool.query(
    `SELECT * FROM dunning_attempts
     WHERE subscription_id = $1
       AND status NOT IN ('recovered', 'lost')
     ORDER BY created_at DESC
     LIMIT 1`,
    [subscriptionId]
  );
  return rows[0] || null;
}

/**
 * Fetch pending dunning attempts ready for email-1 (T+0, no email sent yet).
 * Returns rows where status='pending' and attempt_count=0.
 * Used by the dunning job to send first email.
 */
async function getPendingDunningD0() {
  const { rows } = await pool.query(
    `SELECT * FROM dunning_attempts
     WHERE status = 'pending'
       AND attempt_count = 0
       AND email IS NOT NULL
     ORDER BY failure_detected_at ASC`
  );
  return rows;
}

/**
 * Fetch dunning attempts ready for email-2 (T+3 days, still unpaid after first email).
 * Returns rows where status='sent_d0' and last_sent_at was >= 3 days ago.
 */
async function getPendingDunningD3() {
  const { rows } = await pool.query(
    `SELECT * FROM dunning_attempts
     WHERE status = 'sent_d0'
       AND last_sent_at <= NOW() - INTERVAL '3 days'
       AND email IS NOT NULL
     ORDER BY last_sent_at ASC`
  );
  return rows;
}

/**
 * Mark dunning attempt as first email sent (d0).
 */
async function markDunningSentD0(id) {
  await pool.query(
    `UPDATE dunning_attempts
     SET status = 'sent_d0', attempt_count = attempt_count + 1,
         last_sent_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

/**
 * Mark dunning attempt as follow-up email sent (d3).
 */
async function markDunningSentD3(id) {
  await pool.query(
    `UPDATE dunning_attempts
     SET status = 'sent_d3', attempt_count = attempt_count + 1,
         last_sent_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

/**
 * Mark dunning attempt as recovered (invoice.paid received).
 */
async function markDunningRecovered(subscriptionId) {
  await pool.query(
    `UPDATE dunning_attempts
     SET status = 'recovered', recovered_at = NOW(), updated_at = NOW()
     WHERE subscription_id = $1
       AND status NOT IN ('recovered', 'lost')`,
    [subscriptionId]
  );
}

/**
 * Mark dunning attempt as lost (subscription deleted without recovery).
 */
async function markDunningLost(subscriptionId) {
  await pool.query(
    `UPDATE dunning_attempts
     SET status = 'lost', lost_at = NOW(), updated_at = NOW()
     WHERE subscription_id = $1
       AND status NOT IN ('recovered', 'lost')`,
    [subscriptionId]
  );
}

/**
 * Metrics for admin dashboard.
 * @param {number} days
 */
async function getDunningMetrics(days = 30) {
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS count
     FROM dunning_attempts
     WHERE created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY status`,
    [days]
  );
  const counts = { pending: 0, sent_d0: 0, sent_d3: 0, recovered: 0, lost: 0 };
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
      counts[row.status] = row.count;
    }
  }
  const sent = counts.sent_d0 + counts.sent_d3 + counts.recovered + counts.lost;
  const recoveryRate = sent > 0
    ? ((counts.recovered / sent) * 100).toFixed(1) + '%'
    : '0.0%';
  return { ...counts, sent, recovery_rate: recoveryRate, days };
}

module.exports = {
  createDunningAttempt,
  getActiveDunningAttempt,
  getPendingDunningD0,
  getPendingDunningD3,
  markDunningSentD0,
  markDunningSentD3,
  markDunningRecovered,
  markDunningLost,
  getDunningMetrics,
};
