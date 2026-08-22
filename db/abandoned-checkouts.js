/**
 * Abandoned checkout queries.
 * Owns: abandoned_checkouts table CRUD — create, mark converted, mark emailed, suppression checks.
 * Does NOT own: email sending, Stripe API calls, HTTP routing.
 */
const { pool } = require('./index');
const Sentry = require('@sentry/node');
const crypto = require('crypto');

/**
 * Insert a new pending checkout session (idempotent via ON CONFLICT DO NOTHING).
 * @param {Object} opts
 * @param {string} opts.sessionId
 * @param {string|null} opts.email
 * @param {string|null} opts.tier
 * @param {number|null} opts.amount  — in cents
 * @param {string|null} opts.currency
 * @param {string|null} opts.paymentLink
 */
async function createAbandonedCheckout({ sessionId, email, tier, amount, currency, paymentLink }) {
  const unsubToken = crypto.randomBytes(24).toString('hex');
  try {
    const { rows } = await pool.query(
      `INSERT INTO abandoned_checkouts
         (session_id, email, tier, amount, currency, payment_link, status, unsub_token)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       ON CONFLICT (session_id) DO NOTHING
       RETURNING *`,
      [sessionId, email || null, tier || null, amount || null, currency || 'usd', paymentLink || null, unsubToken]
    );
    return rows[0] || null;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Mark a session as converted (checkout completed).
 */
async function markAbandonedCheckoutConverted(sessionId) {
  await pool.query(
    `UPDATE abandoned_checkouts
     SET status = 'converted', converted_at = NOW()
     WHERE session_id = $1 AND status = 'pending'`,
    [sessionId]
  );
}

/**
 * Mark a session as emailed.
 */
async function markAbandonedCheckoutEmailed(sessionId) {
  await pool.query(
    `UPDATE abandoned_checkouts
     SET status = 'emailed', emailed_at = NOW()
     WHERE session_id = $1`,
    [sessionId]
  );
}

/**
 * Mark a session as suppressed (won't receive email).
 */
async function markAbandonedCheckoutSuppressed(sessionId) {
  await pool.query(
    `UPDATE abandoned_checkouts SET status = 'suppressed' WHERE session_id = $1`,
    [sessionId]
  );
}

/**
 * Fetch pending sessions older than `minAgeMs` that haven't been emailed.
 * @param {number} minAgeMs — minimum age in ms (default 3600000 = 60 min)
 */
async function getPendingAbandonedCheckouts(minAgeMs = 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - minAgeMs);
  const { rows } = await pool.query(
    `SELECT * FROM abandoned_checkouts
     WHERE status = 'pending'
       AND email IS NOT NULL
       AND created_at <= $1
     ORDER BY created_at ASC`,
    [cutoff]
  );
  return rows;
}

/**
 * Check if an email has converted on ANY session in the last 30 days.
 * Used to suppress recovery email when the user already paid via a different session.
 */
async function emailConvertedRecently(email) {
  const { rows } = await pool.query(
    `SELECT 1 FROM abandoned_checkouts
     WHERE LOWER(email) = LOWER($1)
       AND status = 'converted'
       AND converted_at >= NOW() - INTERVAL '30 days'
     LIMIT 1`,
    [email]
  );
  return rows.length > 0;
}

/**
 * Check if an email has already been emailed for an abandoned checkout in the last 30 days.
 * Ensures ONE email per email address (not just per session_id).
 */
async function emailAlreadySentRecently(email) {
  const { rows } = await pool.query(
    `SELECT 1 FROM abandoned_checkouts
     WHERE LOWER(email) = LOWER($1)
       AND status = 'emailed'
       AND emailed_at >= NOW() - INTERVAL '30 days'
     LIMIT 1`,
    [email]
  );
  return rows.length > 0;
}

/**
 * Unsubscribe via token — marks the row suppressed so no future emails are sent.
 * Returns email on success, null if token not found.
 */
async function unsubscribeByToken(token) {
  const { rows } = await pool.query(
    `UPDATE abandoned_checkouts
     SET status = 'suppressed'
     WHERE unsub_token = $1
     RETURNING email`,
    [token]
  );
  return rows[0]?.email || null;
}

/**
 * Metrics for admin dashboard.
 * @param {number} days
 */
async function getAbandonedCheckoutMetrics(days = 7) {
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS count
     FROM abandoned_checkouts
     WHERE created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY status`,
    [days]
  );
  const counts = { pending: 0, converted: 0, emailed: 0, suppressed: 0 };
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
      counts[row.status] = row.count;
    }
  }
  const emailsSent = counts.emailed;
  const total = emailsSent + counts.converted + counts.pending + counts.suppressed;
  const recoveryRate = emailsSent > 0
    ? ((counts.converted / emailsSent) * 100).toFixed(1) + '%'
    : '0.0%';
  return { ...counts, recovery_rate: recoveryRate, total, days };
}

module.exports = {
  createAbandonedCheckout,
  markAbandonedCheckoutConverted,
  markAbandonedCheckoutEmailed,
  markAbandonedCheckoutSuppressed,
  getPendingAbandonedCheckouts,
  emailConvertedRecently,
  emailAlreadySentRecently,
  unsubscribeByToken,
  getAbandonedCheckoutMetrics,
};
