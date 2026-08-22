/**
 * Affiliates DB queries.
 * Owns: affiliates table reads/writes for the therapist/coach affiliate program.
 * Does NOT own: email sending, route logic, Stripe Connect payouts.
 */
const { pool } = require('./index');
const crypto = require('crypto');

/**
 * Generate a short unique affiliate code from a name + random suffix.
 * Format: e.g. "sarah-k-x7f2"
 */
function generateAffCode(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .split(' ')
    .slice(0, 2)
    .join('-');
  const suffix = crypto.randomBytes(3).toString('hex').slice(0, 4);
  return `${base}-${suffix}`;
}

/**
 * Insert a new affiliate application. Returns the inserted row, or null if duplicate email.
 */
async function addAffiliate({ name, practiceHandle, email, audienceSize }) {
  const affCode = generateAffCode(name);
  const result = await pool.query(
    `INSERT INTO affiliates (name, practice_handle, email, audience_size, aff_code)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (LOWER(email)) DO NOTHING
     RETURNING id, name, practice_handle, email, audience_size, aff_code, status, created_at`,
    [
      name.trim(),
      (practiceHandle || '').trim() || null,
      email.toLowerCase().trim(),
      (audienceSize || '').trim() || null,
      affCode,
    ]
  );
  return result.rows[0] || null;
}

/**
 * Find an affiliate by their aff_code (for attribution cookie resolution).
 */
async function getAffiliateByCode(affCode) {
  const result = await pool.query(
    'SELECT id, name, email, aff_code, status FROM affiliates WHERE aff_code = $1',
    [affCode]
  );
  return result.rows[0] || null;
}

/**
 * Fetch all affiliates (admin use).
 */
async function getAllAffiliates() {
  const result = await pool.query(
    'SELECT id, name, practice_handle, email, audience_size, aff_code, status, created_at FROM affiliates ORDER BY created_at DESC'
  );
  return result.rows;
}

module.exports = { addAffiliate, getAffiliateByCode, getAllAffiliates };
