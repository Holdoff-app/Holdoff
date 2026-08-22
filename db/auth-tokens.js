/**
 * Auth token queries — HoldOff server-side token management.
 * Owns: auth_refresh_tokens and password_reset_tokens tables.
 * Does NOT own: JWT signing, password hashing, route handlers.
 */
const { pool } = require('./index');

/**
 * Create a new refresh token record.
 * @param {number} userId
 * @param {string} tokenHash  — bcrypt hash of the raw opaque token
 * @param {Date}   expiresAt
 * @param {string} [userAgent]
 */
async function createRefreshToken(userId, tokenHash, expiresAt, userAgent) {
  await pool.query(
    `INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, expiresAt, userAgent || null]
  );
}

/**
 * Find an active refresh token by its bcrypt hash.
 * Returns { id, user_id, expires_at } or null if not found/revoked/expired.
 */
async function findRefreshToken(tokenHash) {
  const { rows } = await pool.query(
    `SELECT id, user_id, expires_at
     FROM auth_refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] || null;
}

/**
 * Revoke a single refresh token by its hash (set revoked_at=NOW()).
 * Returns true if a row was updated.
 */
async function revokeRefreshToken(tokenHash) {
  const { rowCount } = await pool.query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
  return rowCount > 0;
}

/**
 * Revoke every active refresh token for a user (used at logout / password change).
 */
async function revokeAllUserTokens(userId) {
  await pool.query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

/**
 * Create a password reset token record.
 * @param {number} userId
 * @param {string} tokenHash  — bcrypt hash of the raw token
 * @param {Date}   expiresAt  — typically 1 hour from now
 */
async function createPasswordResetToken(userId, tokenHash, expiresAt) {
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

/**
 * Consume a password reset token: atomically mark it used and return userId.
 * Returns userId if token is valid and unused; null otherwise.
 * This is the only function that sets used_at.
 */
async function consumePasswordResetToken(tokenHash) {
  const { rows } = await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );
  return rows[0]?.user_id || null;
}

/**
 * Invalidate every unused password reset token for a user.
 * Called after a successful password change so other tokens become invalid.
 */
async function invalidatePasswordResetTokens(userId) {
  await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
}

module.exports = {
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  createPasswordResetToken,
  consumePasswordResetToken,
  invalidatePasswordResetTokens,
};
