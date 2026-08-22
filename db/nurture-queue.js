/**
 * Nurture queue DB queries.
 * Owns: nurture_queue table reads/writes for auto_intercept email sequence.
 * Does NOT own: email sending, template rendering, route logic.
 */
const { pool } = require('./index');

/**
 * Enqueue a scheduled nurture email for an auto_intercept signup.
 * @param {string} email
 * @param {number} step - 2 or 3
 * @param {Date}   scheduledAt
 */
async function enqueueNurtureEmail(email, step, scheduledAt) {
  await pool.query(
    `INSERT INTO nurture_queue (email, email_step, scheduled_at)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [email.toLowerCase().trim(), step, scheduledAt]
  );
}

/**
 * Fetch all unsent, non-failed nurture emails that are due to send.
 * Returns rows sorted by scheduled_at ASC.
 */
async function getDueNurtureEmails(step) {
  const result = await pool.query(
    `SELECT id, email, email_step, scheduled_at
     FROM nurture_queue
     WHERE email_step = $1
       AND scheduled_at <= NOW()
       AND sent_at IS NULL
       AND failed_at IS NULL
     ORDER BY scheduled_at ASC
     LIMIT 100`,
    [step]
  );
  return result.rows;
}

/**
 * Fetch all unsent, non-failed email-3 rows (any scheduled_at — used for manual launch blast).
 */
async function getPendingLaunchEmails() {
  const result = await pool.query(
    `SELECT id, email
     FROM nurture_queue
     WHERE email_step = 3
       AND sent_at IS NULL
       AND failed_at IS NULL
     ORDER BY created_at ASC`
  );
  return result.rows;
}

/** Mark a row as sent. */
async function markNurtureSent(id) {
  await pool.query(
    `UPDATE nurture_queue SET sent_at = NOW() WHERE id = $1`,
    [id]
  );
}

/** Mark a row as failed with an error message. */
async function markNurtureFailed(id, errorMessage) {
  await pool.query(
    `UPDATE nurture_queue
     SET failed_at = NOW(), error_message = $2
     WHERE id = $1`,
    [id, errorMessage]
  );
}

module.exports = {
  enqueueNurtureEmail,
  getDueNurtureEmails,
  getPendingLaunchEmails,
  markNurtureSent,
  markNurtureFailed,
};
