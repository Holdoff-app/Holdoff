/**
 * Waitlist DB queries.
 * Owns: waitlist table reads/writes.
 * Does NOT own: email sending, route logic.
 */
const { pool } = require('./index');

/**
 * Insert a new waitlist email. Returns the inserted row, or null if duplicate.
 */
async function addToWaitlist(email, source = 'landing') {
  const result = await pool.query(
    `INSERT INTO waitlist (email, source)
     VALUES ($1, $2)
     ON CONFLICT (LOWER(email)) DO NOTHING
     RETURNING id, email, source, created_at`,
    [email.toLowerCase().trim(), source]
  );
  return result.rows[0] || null;
}

/**
 * Check if an email is already on the waitlist.
 */
async function isOnWaitlist(email) {
  const result = await pool.query(
    'SELECT id FROM waitlist WHERE LOWER(email) = LOWER($1)',
    [email.trim()]
  );
  return result.rows.length > 0;
}

module.exports = { addToWaitlist, isOnWaitlist };
