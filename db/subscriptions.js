/**
 * Subscription queries — HoldOff Pro entitlement storage.
 * Owns: subscriptions table, magic_tokens table.
 * Does NOT own: Stripe API calls, cookie handling, HTTP routing.
 */
const { pool } = require('./index');

/**
 * Get subscription by email. Returns null if not found.
 */
async function getSubscriptionByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM subscriptions WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return rows[0] || null;
}

/**
 * Get subscription by Stripe customer ID.
 */
async function getSubscriptionByCustomerId(stripeCustomerId) {
  const { rows } = await pool.query(
    'SELECT * FROM subscriptions WHERE stripe_customer_id = $1',
    [stripeCustomerId]
  );
  return rows[0] || null;
}

/**
 * Get subscription by Stripe subscription ID.
 */
async function getSubscriptionByStripeSubId(stripeSubscriptionId) {
  const { rows } = await pool.query(
    'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1',
    [stripeSubscriptionId]
  );
  return rows[0] || null;
}

/**
 * Upsert subscription record on checkout completion or renewal.
 * Accepts either `tier` or `membershipType` (both normalized to membership_type column).
 * grace_until is NOT reset on every upsert — payment failure sets it, renewal clears it.
 */
async function upsertSubscription({ email, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd, tier, membershipType }) {
  const resolvedTier = membershipType || tier || 'online';
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (email, stripe_customer_id, stripe_subscription_id, status, current_period_end, membership_type, updated_at)
     VALUES (LOWER($1), $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (LOWER(email)) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       status = EXCLUDED.status,
       current_period_end = EXCLUDED.current_period_end,
       membership_type = EXCLUDED.membership_type,
       updated_at = NOW()
     RETURNING *`,
    [email, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd || null, resolvedTier]
  );
  return rows[0];
}

/**
 * Set grace period on payment failure (3 days).
 */
async function setGracePeriod(stripeSubscriptionId) {
  const graceUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await pool.query(
    `UPDATE subscriptions SET grace_until = $1, status = 'past_due', updated_at = NOW()
     WHERE stripe_subscription_id = $2`,
    [graceUntil, stripeSubscriptionId]
  );
}

/**
 * Clear grace period on successful payment renewal.
 */
async function clearGracePeriod(stripeSubscriptionId) {
  await pool.query(
    `UPDATE subscriptions SET grace_until = NULL, status = 'active', updated_at = NOW()
     WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId]
  );
}

/**
 * Revoke subscription (cancelled or grace expired).
 */
async function revokeSubscription(stripeSubscriptionId) {
  await pool.query(
    `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
     WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId]
  );
}

/**
 * Check if email has active Pro access (active or within grace period).
 */
async function isProEmail(email) {
  const sub = await getSubscriptionByEmail(email);
  if (!sub) return false;
  if (sub.status === 'active') return true;
  // Allow access during grace period (payment failed but not yet revoked)
  if (sub.status === 'past_due' && sub.grace_until && new Date(sub.grace_until) > new Date()) {
    return true;
  }
  return false;
}

/**
 * Get membership type for an email ('online' | 'app' | 'lifetime' | null).
 * Uses subscription record if available, otherwise falls back to users table.
 */
async function getMembershipType(email) {
  const sub = await getSubscriptionByEmail(email);
  if (sub?.membership_type) return sub.membership_type;
  // Fallback to users table
  const { pool } = require('./index');
  const { rows } = await pool.query(
    'SELECT membership_type FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return rows[0]?.membership_type || null;
}

/**
 * Check if an email has at least the specified membership level.
 * Hierarchy: lifetime > app > online
 * @param {string} email
 * @param {'online'|'app'|'lifetime'} requiredLevel
 */
async function hasMembershipLevel(email, requiredLevel) {
  const type = await getMembershipType(email);
  if (!type) return false;
  const hierarchy = { online: 1, app: 2, lifetime: 3 };
  return (hierarchy[type] || 0) >= (hierarchy[requiredLevel] || 0);
}

// --- Magic token functions ---

/**
 * Create a single-use magic link token for restore access.
 * Expires in 1 hour.
 */
async function createMagicToken(email) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await pool.query(
    `INSERT INTO magic_tokens (email, token, expires_at) VALUES (LOWER($1), $2, $3)`,
    [email, token, expiresAt]
  );
  return token;
}

/**
 * Consume a magic token. Returns email on success, null if invalid/expired/used.
 */
async function consumeMagicToken(token) {
  const { rows } = await pool.query(
    `UPDATE magic_tokens
     SET used_at = NOW()
     WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING email`,
    [token]
  );
  return rows[0]?.email || null;
}

module.exports = {
  getSubscriptionByEmail,
  getSubscriptionByCustomerId,
  getSubscriptionByStripeSubId,
  upsertSubscription,
  setGracePeriod,
  clearGracePeriod,
  revokeSubscription,
  isProEmail,
  getMembershipType,
  hasMembershipLevel,
  createMagicToken,
  consumeMagicToken,
};
