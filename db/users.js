/**
 * User account queries — HoldOff user management.
 * Owns: users table (account CRUD, password management, email verification).
 * Does NOT own: Stripe, subscriptions table, session/JWT infrastructure.
 */
const { pool } = require('./index');

/**
 * Create a new user account. Returns the user row (sans password_hash).
 */
async function createUser({ email, name, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, password_hash)
     VALUES (LOWER($1), $2, $3)
     ON CONFLICT (LOWER(email)) DO NOTHING
     RETURNING id, email, name, created_at, subscription_status`,
    [email, name || null, passwordHash]
  );
  return rows[0] || null;
}

/**
 * Find user by email. Returns full row (including password_hash).
 */
async function findUserByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return rows[0] || null;
}

/**
 * Find user by ID. Returns row sans password_hash.
 */
async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT id, email, name, created_at, updated_at,
            subscription_status, subscription_plan, subscription_expires_at,
            membership_type, attachment_style
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Update a user's membership type (online | app | lifetime).
 */
async function updateMembershipType(userId, membershipType) {
  const { rows } = await pool.query(
    `UPDATE users SET membership_type = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, membership_type`,
    [userId, membershipType]
  );
  return rows[0] || null;
}

/**
 * Update user email. Returns updated row.
 */
async function updateUserEmail(userId, newEmail) {
  const { rows } = await pool.query(
    `UPDATE users SET email = LOWER($2), updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, created_at, updated_at`,
    [userId, newEmail]
  );
  return rows[0] || null;
}

/**
 * Update user password. Returns true on success.
 */
async function updateUserPassword(userId, passwordHash) {
  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [userId, passwordHash]
  );
  return rows.length > 0;
}

/**
 * Set email verification token. Expires in 1 hour.
 */
async function setEmailVerificationToken(userId, token) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await pool.query(
    `UPDATE users SET
       email_verification_token = $2,
       email_verification_expires_at = $3,
       updated_at = NOW()
     WHERE id = $1`,
    [userId, token, expiresAt]
  );
}

/**
 * Consume email verification token. Returns userId on success, null otherwise.
 * Clears the token after use.
 */
async function consumeEmailVerificationToken(token) {
  const { rows } = await pool.query(
    `UPDATE users
     SET email_verified = TRUE,
         email_verification_token = NULL,
         email_verification_expires_at = NULL,
         updated_at = NOW()
     WHERE email_verification_token = $1
       AND email_verification_expires_at > NOW()
       AND email_verified = FALSE
     RETURNING id`,
    [token]
  );
  return rows[0]?.id || null;
}

/**
 * Check if email is verified.
 */
async function isEmailVerified(userId) {
  const { rows } = await pool.query(
    'SELECT email_verified FROM users WHERE id = $1',
    [userId]
  );
  return rows[0]?.email_verified === true;
}

/**
 * Soft-delete user account. Removes PII, anonymizes, keeps row for audit.
 */
async function deleteUser(userId) {
  const { rows } = await pool.query(
    `UPDATE users SET
       email = 'deleted_' || $1 || '@deleted.local',
       name = NULL,
       password_hash = NULL,
       email_verification_token = NULL,
       email_verification_expires_at = NULL,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [userId]
  );
  return rows.length > 0;
}

/**
 * Check if email is already taken by another user.
 */
async function isEmailTaken(email, excludeUserId) {
  const { rows } = await pool.query(
    `SELECT id FROM users
     WHERE LOWER(email) = LOWER($1) AND id != $2
     LIMIT 1`,
    [email, excludeUserId]
  );
  return rows.length > 0;
}

/**
 * Stamp welcome_sent_at on the user row. Returns false if already stamped (dedup guard).
 * WHY: atomic CAS prevents duplicate sends if signup fires twice or retries race.
 */
async function markWelcomeSent(userId) {
  const { rows } = await pool.query(
    `UPDATE users SET welcome_sent_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND welcome_sent_at IS NULL
     RETURNING id`,
    [userId]
  );
  return rows.length > 0; // false = already sent, caller should skip
}

/**
 * Record first paywall hit timestamp. Only writes if paywall_hit_at is null (first hit only).
 * Returns true if stamped, false if already stamped or user not found.
 */
async function setPaywallHitAt(userId) {
  const { rows } = await pool.query(
    `UPDATE users SET paywall_hit_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND paywall_hit_at IS NULL
     RETURNING id`,
    [userId]
  );
  return rows.length > 0;
}

/**
 * Stamp winback_sent_at on the user row (dedup guard). Returns false if already set.
 */
async function markWinbackSent(userId) {
  const { rows } = await pool.query(
    `UPDATE users SET winback_sent_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND winback_sent_at IS NULL
     RETURNING id`,
    [userId]
  );
  return rows.length > 0;
}

/**
 * Fetch users eligible for the 7-day win-back email.
 * Criteria: paywall_hit_at between 7 and 8 days ago, no active subscription, winback_sent_at is null.
 * Returns rows with { id, email, name }.
 */
async function getWinbackCandidates() {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name
     FROM users u
     LEFT JOIN subscriptions s ON LOWER(u.email) = LOWER(s.email) AND s.status = 'active'
     WHERE u.paywall_hit_at IS NOT NULL
       AND u.paywall_hit_at >= NOW() - INTERVAL '8 days'
       AND u.paywall_hit_at < NOW() - INTERVAL '7 days'
       AND u.winback_sent_at IS NULL
       AND s.email IS NULL
     ORDER BY u.paywall_hit_at ASC`
  );
  return rows;
}

/**
 * Fetch user stats: streak, lifetime holds/rewrites, subscription status.
 */
async function getUserStats(userId) {
  const { rows } = await pool.query(
    `SELECT u.streak_count, u.lifetime_holds, u.lifetime_rewrites,
            u.attachment_style, u.quiz_completed,
            u.subscription_status, u.subscription_plan, u.subscription_expires_at,
            s.status as active_subscription_status
     FROM users u
     LEFT JOIN subscriptions s ON LOWER(u.email) = LOWER(s.email) AND s.status = 'active'
     WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Update attachment_style after quiz completion. Validates enum value.
 */
async function updateAttachmentStyle(userId, style) {
  const valid = ['anxious', 'secure', 'avoidant', 'fearful'];
  if (!valid.includes(style)) throw new Error('Invalid attachment_style');
  await pool.query(
    `UPDATE users SET attachment_style = $2, quiz_completed = TRUE, updated_at = NOW()
     WHERE id = $1`,
    [userId, style]
  );
}

/**
 * Update user profile fields (name, attachment_style).
 */
async function updateUserProfile(userId, { name, attachmentStyle }) {
  const fields = [];
  const vals = [];
  let i = 1;
  if (name !== undefined) { fields.push(`name = $${i++}`); vals.push(name); }
  if (attachmentStyle !== undefined) { fields.push(`attachment_style = $${i++}`); vals.push(attachmentStyle); }
  if (!fields.length) return null;
  vals.push(userId);
  const { rows } = await pool.query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING id, email, name, attachment_style`,
    vals
  );
  return rows[0] || null;
}

// Proxy re-exports from db/auth-tokens.js — keeps all auth token logic in one place.
const authTokens = require('./auth-tokens');

const createRefreshToken = authTokens.createRefreshToken;
const revokeAllRefreshTokens = authTokens.revokeAllUserTokens;
const createPasswordResetToken = authTokens.createPasswordResetToken;
const consumePasswordResetToken = authTokens.consumePasswordResetToken;
const invalidatePasswordResetTokens = authTokens.invalidatePasswordResetTokens;

/**
 * Update pattern journal streak on the users row.
 * Called after every successful verdict for logged-in users.
 * Returns the updated { current_streak, last_active_at }.
 */
async function updateUserStreak(userId) {
  const now = new Date();
  const { rows } = await pool.query(
    `SELECT current_streak, last_active_at FROM users WHERE id = $1`,
    [userId]
  );
  if (!rows.length) return null;

  const row = rows[0];
  const lastActive = row.last_active_at ? new Date(row.last_active_at) : null;
  let newStreak = row.current_streak || 0;

  if (!lastActive) {
    newStreak = 1;
  } else {
    const diffMs = now.getTime() - lastActive.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours >= 24 && diffHours < 48) {
      newStreak += 1;
    } else if (diffHours >= 48) {
      newStreak = 1;
    }
  }

  await pool.query(
    `UPDATE users SET current_streak = $2, last_active_at = $3, updated_at = NOW() WHERE id = $1`,
    [userId, newStreak, now]
  );
  return { current_streak: newStreak, last_active_at: now };
}

async function clearAttachmentProfile(userId) {
  await pool.query(`DELETE FROM user_attachment_responses WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM user_attachment_profiles WHERE user_id = $1`, [userId]);
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserEmail,
  updateUserPassword,
  setEmailVerificationToken,
  consumeEmailVerificationToken,
  isEmailVerified,
  deleteUser,
  isEmailTaken,
  updateMembershipType,
  markWelcomeSent,
  setPaywallHitAt,
  markWinbackSent,
  getWinbackCandidates,
  createRefreshToken,
  revokeAllRefreshTokens,
  createPasswordResetToken,
  consumePasswordResetToken,
  invalidatePasswordResetTokens,
  getUserStats,
  updateAttachmentStyle,
  updateUserProfile,
  clearAttachmentProfile,
  updateUserStreak,
};