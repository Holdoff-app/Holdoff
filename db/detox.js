/**
 * Detox subscriber DB queries.
 * Owns: detox_subscribers table reads/writes for the 5-day email course.
 * Does NOT own: email sending, template rendering, route logic.
 */
const { pool } = require('./index');

/**
 * Insert a new detox subscriber. Returns the inserted row, or null if duplicate.
 * On duplicate, returns { alreadySubscribed: true }.
 */
async function addDetoxSubscriber(email) {
  const result = await pool.query(
    `INSERT INTO detox_subscribers (email)
     VALUES ($1)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, subscribed_at, next_step, next_send_at`,
    [email.toLowerCase().trim()]
  );
  return result.rows[0] || null;
}

/**
 * Fetch up to 50 detox subscribers due for their next email.
 * Returns rows where next_step < 5, unsubscribed = false, and next_send_at <= NOW().
 */
async function getDueDetoxSubscribers() {
  const result = await pool.query(
    `SELECT id, email, next_step
     FROM detox_subscribers
     WHERE next_step < 5
       AND unsubscribed = FALSE
       AND next_send_at <= NOW()
     ORDER BY next_send_at ASC
     LIMIT 50`
  );
  return result.rows;
}

/**
 * Advance a subscriber to the next step, scheduling the next send 24h from now.
 * If next_step would become 5, mark as complete (no more sends).
 */
async function advanceDetoxSubscriber(id) {
  await pool.query(
    `UPDATE detox_subscribers
     SET next_step = next_step + 1,
         next_send_at = NOW() + INTERVAL '24 hours'
     WHERE id = $1`,
    [id]
  );
}

/**
 * Mark a subscriber as unsubscribed.
 */
async function unsubscribeDetox(email) {
  await pool.query(
    `UPDATE detox_subscribers SET unsubscribed = TRUE WHERE email = LOWER($1)`,
    [email.trim()]
  );
}

module.exports = {
  addDetoxSubscriber,
  getDueDetoxSubscribers,
  advanceDetoxSubscriber,
  unsubscribeDetox,
};
