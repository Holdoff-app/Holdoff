/**
 * Beta testers database module.
 * Stores public signups from /beta page for Play Store internal testing.
 */
const { pool } = require('./index');

/**
 * Ensure the beta_testers table exists.
 */
async function ensureBetaTestersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS beta_testers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120),
      email VARCHAR(255) NOT NULL UNIQUE,
      device VARCHAR(100),
      why TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      invited_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_beta_testers_status ON beta_testers(status);
    CREATE INDEX IF NOT EXISTS idx_beta_testers_email ON beta_testers(email);
  `);
}

/**
 * Add a new beta tester signup.
 * Returns the inserted row, or null if the email already exists.
 */
async function addBetaTester({ name, email, device, why }) {
  try {
    const result = await pool.query(
      `INSERT INTO beta_testers (name, email, device, why)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING *`,
      [name || null, email.toLowerCase().trim(), device || null, why || null]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('[beta-testers] addBetaTester error:', err.message);
    throw err;
  }
}

/**
 * Get all pending testers (not yet invited to Play Console).
 */
async function getPendingTesters() {
  const result = await pool.query(
    `SELECT * FROM beta_testers WHERE status = 'pending' ORDER BY created_at ASC`
  );
  return result.rows;
}

/**
 * Mark a tester as invited.
 */
async function markTesterInvited(email) {
  await pool.query(
    `UPDATE beta_testers SET status = 'invited', invited_at = NOW() WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
}

/**
 * Get all testers (for admin view).
 */
async function getAllTesters() {
  const result = await pool.query(
    `SELECT id, name, email, device, status, invited_at, created_at
     FROM beta_testers ORDER BY created_at DESC`
  );
  return result.rows;
}

module.exports = { ensureBetaTestersTable, addBetaTester, getPendingTesters, markTesterInvited, getAllTesters };
