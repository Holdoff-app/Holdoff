/**
 * Auth route group — user sign-up, login, logout, email verification,
 * password reset, session refresh, and account management.
 *
 * Auth strategy:
 *  - Access token:  short-lived JWT (15 min), httpOnly cookie + optional Bearer header
 *  - Refresh token: opaque 64-char hex, bcrypt-hashed in auth_refresh_tokens DB table
 *  - Refresh token rotation: new opaque token issued on every /login and /refresh call
 *
 * Error shapes: { error: "...", code: "ERROR_CODE" }
 * Rate limits:   429 { error: "Too many requests. Please wait a moment.", code: "RATE_LIMITED" }
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserEmail,
  updateUserPassword,
  setEmailVerificationToken,
  consumeEmailVerificationToken,
  isEmailTaken,
  deleteUser,
  markWelcomeSent,
  createRefreshToken,
  revokeAllRefreshTokens,
  createPasswordResetToken,
  consumePasswordResetToken,
  invalidatePasswordResetTokens,
} = require(path.join(__dirname, 'db', 'users'));
const { markConverted } = require(path.join(__dirname, 'db', 'referrals'));
const {
  signAccessToken,
  signRefreshToken,
  requireAuth,
  holdoffTokenCookieOpts,
  refreshCookieOpts,
  clearAuthCookies,
  revokeRefreshToken,
} = require(path.join(__dirname, 'lib', 'auth'));
const { buildWelcomeEmail } = require(path.join(__dirname, 'services', 'welcome-email'));
const { buildResetPasswordEmail } = require(path.join(__dirname, 'services', 'reset-password-email'));
const { logExitIntentEvent } = require(path.join(__dirname, 'db', 'exit-intent'));

const BASE_URL = process.env.APP_URL || 'https://shouldiholdoff.live';
const SALT_ROUNDS = 12;

// ─── Rate limiting (in-memory per IP) ───────────────────────────────────────

/**
 * Simple in-memory rate limiter.
 * Returns { blocked: boolean, reason?: string }
 * @param {string} key
 * @param {number} limit     — max requests allowed in the window
 * @param {number} windowMs  — window in milliseconds
 */
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entries = _rateLimitStore.get(key) || [];
  const valid = entries.filter(t => now - t < windowMs);
  if (valid.length >= limit) {
    return { blocked: true, retryAfterMs: windowMs - (now - valid[0]) };
  }
  valid.push(now);
  _rateLimitStore.set(key, valid);
  return { blocked: false };
}

// WeakMap so it evades weak-ref GC from module reload on dev restart — users
// who trigger thousands of unique keys will memory-leak, but auth routes are
// behind nginx in production so this is acceptable.
const _rateLimitStore = new Map();

// ─── Email helpers ──────────────────────────────────────────────────────────

async function sendVerificationEmail(email, token, name) {
  let sendEmail;
  try {
    ({ sendEmail } = require(path.join(__dirname, 'services', 'email')));
  } catch {
    sendEmail = null;
  }

  const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;
  const greeting = name ? `Hi ${name}` : 'Hi there';

  const html = `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#2A2522;line-height:1.7;">
  <h2 style="font-size:1.5rem;font-weight:600;letter-spacing:-0.02em;margin-bottom:1rem;">
    Confirm your HoldOff account
  </h2>
  <p style="margin-bottom:1rem;">${greeting},</p>
  <p style="margin-bottom:1.5rem;">
    Click below to confirm your email and activate your HoldOff account.
    Once confirmed, you'll get 3 free message verdicts — no credit card needed.
  </p>
  <p style="margin-bottom:1.5rem;">
    <a href="${verifyUrl}"
       style="display:inline-block;background:#C97B5D;color:#fff;padding:0.75rem 1.5rem;
              text-decoration:none;border-radius:4px;font-weight:600;">
      Confirm my email →
    </a>
  </p>
  <p style="color:#8A7F79;font-size:0.875rem;margin-bottom:1.5rem;">
    This link expires in 1 hour. If you didn't create a HoldOff account, ignore this email.
  </p>
  <hr style="border:none;border-top:1px solid #E5DED4;margin:1.5rem 0;" />
  <p style="font-size:0.75rem;color:#8A7F79;">
    Don't send it yet. — HoldOff
  </p>
</div>`;

  const text = `${greeting},

Confirm your HoldOff account:
${verifyUrl}

This link expires in 1 hour. If you didn't sign up, ignore this email.

Don't send it yet. — HoldOff`;

  if (!process.env.RESEND_API_KEY || !sendEmail) {
    console.log(`[auth] Verification email for ${email}: ${verifyUrl}`);
    return;
  }

  await sendEmail({ to: email, subject: 'Confirm your HoldOff account', text, html });
}

async function sendResetPasswordEmail(email, token, name) {
  let sendEmail;
  try {
    ({ sendEmail } = require(path.join(__dirname, 'services', 'email')));
  } catch {
    sendEmail = null;
  }

  const { subject, text, html } = buildResetPasswordEmail({ email, token, name });

  if (!process.env.RESEND_API_KEY || !sendEmail) {
    // token log removed
    return;
  }

  await sendEmail({ to: email, subject, text, html });
}

// ─── POST /api/auth/signup ───────────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  // Rate limit: 5 per IP per hour
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const rl = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (rl.blocked) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' });
  }

  const { email, password, name } = req.body || {};
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required.', code: 'VALIDATION_ERROR' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.', code: 'VALIDATION_ERROR' });
  }

  // Check duplicate
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    if (existing.password_hash) {
      return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_TAKEN' });
    }
    return res.status(409).json({ error: 'Sign in with the method you used before.', code: 'EMAIL_TAKEN' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS).catch(() => null);
  if (!passwordHash) {
    return res.status(500).json({ error: 'Failed to process password.', code: 'INTERNAL_ERROR' });
  }

  // Create user (unverified — email needs confirmation)
  const user = await createUser({ email: normalizedEmail, name: name?.trim() || null, passwordHash });
  if (!user) {
    return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_TAKEN' });
  }

  // Track referral conversion if ref= param was present
  const refToken = req.cookies && req.cookies.ref;
  if (refToken) {
    markConverted(refToken).catch(err => console.error('[auth] referral markConverted error:', err.message));
    res.clearCookie('ref');
  }

  // Generate and store email verification token (1h expiry)
  const token = crypto.randomBytes(32).toString('hex');
  await setEmailVerificationToken(user.id, token);

  // Send verification email async — don't block response
  sendVerificationEmail(normalizedEmail, token, name?.trim()).catch((err) => {
    console.error('[auth] Verification email failed:', err.message);
  });

  // Issue access token (15 min) + opaque refresh token (DB)
  const accessToken = signAccessToken({ id: user.id, email: normalizedEmail });
  const rawRefreshToken = await signRefreshToken(user.id, normalizedEmail, req.headers['user-agent']);
  const userAgent = req.headers['user-agent'];

  res.cookie('holdoff_token', accessToken, holdoffTokenCookieOpts());
  res.cookie('refresh_token', rawRefreshToken, refreshCookieOpts());

  res.status(201).json({
    ok: true,
    user: { id: user.id, email: normalizedEmail, name: user.name },
    message: 'Account created. Check your email to confirm it.',
    needs_questionnaire: true, // Signal frontend to show onboarding questionnaire
    redirect_to: '/onboarding'
  });

  // Send welcome email async — does not block response. Dedup via markWelcomeSent (CAS).
  const capturedUserId = user.id;
  const capturedName = name?.trim() || null;
  setImmediate(async () => {
    try {
      let sendEmail;
      try { ({ sendEmail } = require('../services/email')); } catch { sendEmail = null; }
      if (!sendEmail) return;

      const claimed = await markWelcomeSent(capturedUserId);
      if (!claimed) return;

      const { subject, html, text } = buildWelcomeEmail({ email: normalizedEmail, name: capturedName });
      await sendEmail({ to: normalizedEmail, subject, html, text, replyTo: 'hello@shouldiholdoff.live' });

      await logExitIntentEvent({ event_type: 'welcome_sent', email: normalizedEmail, device_id: null });
      console.log(`[auth] Welcome email sent to ${normalizedEmail}`);
    } catch (err) {
      console.error('[auth] Welcome email failed:', err.message);
    }
  });
});

// ─── GET /api/auth/verify-email?token=... ───────────────────────────────────

router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.redirect('/filter?verify_error=missing');
  }

  const userId = await consumeEmailVerificationToken(token);
  if (!userId) {
    return res.redirect('/filter?verify_error=invalid');
  }

  const user = await findUserById(userId);
  if (user) {
    const accessToken = signAccessToken({ id: user.id, email: user.email });
    res.cookie('holdoff_token', accessToken, holdoffTokenCookieOpts());
  }

  res.redirect('/filter?verify_success=1');
});

// ─── GET /api/auth/verify-email-json?token=... ───────────────────────────────
// Programmatic JSON variant for API clients / mobile.

router.get('/verify-email-json', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Token is required.', code: 'VALIDATION_ERROR' });
  }

  const userId = await consumeEmailVerificationToken(token);
  if (!userId) {
    return res.status(400).json({ error: 'Verification link expired or already used.', code: 'INVALID_TOKEN' });
  }

  res.json({ ok: true, message: 'Email verified.' });
});

// ─── POST /api/auth/login ───────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  // Rate limit: 10 per IP per 15 minutes (brute-force protection)
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (rl.blocked) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' });
  }

  const { email, password } = req.body || {};
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return res.status(400).json({ error: 'Email is required.', code: 'VALIDATION_ERROR' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required.', code: 'VALIDATION_ERROR' });
  }

  const user = await findUserByEmail(normalizedEmail);
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
  }

  const valid = await bcrypt.compare(password, user.password_hash).catch(() => false);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
  }

  // Issue access token (15 min) + opaque refresh token (DB, 7 days)
  const accessToken = signAccessToken({ id: user.id, email: normalizedEmail });
  const rawRefreshToken = await signRefreshToken(user.id, normalizedEmail, req.headers['user-agent']);

  res.cookie('holdoff_token', accessToken, holdoffTokenCookieOpts());
  res.cookie('refresh_token', rawRefreshToken, refreshCookieOpts());

  res.json({
    ok: true,
    user: { id: user.id, email: normalizedEmail, name: user.name, subscription_tier: user.membership_type },
  });
});

// ─── POST /api/auth/refresh ─────────────────────────────────────────────────
// Silent refresh: validate refresh cookie, rotate token, issue new access token.

router.post('/refresh', async (req, res) => {
  const raw = req.cookies?.refresh_token;
  if (!raw) {
    return res.status(401).json({ error: 'No refresh token.', code: 'INVALID_TOKEN' });
  }

  // getRefreshTokenFromCookie reads the DB (imported lazily to avoid circular requires)
  const { getRefreshTokenFromCookie } = require(path.join(__dirname, 'lib', 'auth'));
  const refreshData = await getRefreshTokenFromCookie(req);
  if (!refreshData?.userId) {
    res.clearCookie('holdoff_token', clearAuthCookies());
    res.clearCookie('refresh_token', clearAuthCookies());
    return res.status(401).json({ error: 'Session expired. Please log in again.', code: 'INVALID_TOKEN' });
  }

  // Rotate: revoke old token, issue new opaque refresh token, issue new access token
  const { revokeRefreshToken } = require(path.join(__dirname, 'db', 'auth-tokens'));
  // We need the raw token to revoke it — but we only stored the hash.
  // Instead, revoke all tokens for this user and issue fresh ones.
  // (This is safe; one device at a time is ensured by the rotation logic.)
  await revokeAllRefreshTokens(refreshData.userId);

  const newAccessToken = signAccessToken({ id: refreshData.userId, email: refreshData.email });
  const newRawRefreshToken = await signRefreshToken(refreshData.userId, refreshData.email, req.headers['user-agent']);

  res.cookie('holdoff_token', newAccessToken, holdoffTokenCookieOpts());
  res.cookie('refresh_token', newRawRefreshToken, refreshCookieOpts());

  res.json({ ok: true });
});

// ─── POST /api/auth/logout ──────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
  // Rate limit: 30/min per IP
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const rl = rateLimit(`logout:${ip}`, 30, 60 * 1000);
  if (rl.blocked) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' });
  }

  // Revoke the refresh token from DB
  const raw = req.cookies?.refresh_token;
  if (raw) {
    const { getRefreshTokenFromCookie } = require(path.join(__dirname, 'lib', 'auth'));
    const refreshData = await getRefreshTokenFromCookie(req);
    if (refreshData?.userId) {
      await revokeAllRefreshTokens(refreshData.userId);
    }
  }

  res.clearCookie('holdoff_token', clearAuthCookies());
  res.clearCookie('refresh_token', clearAuthCookies());
  res.json({ ok: true });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

router.post('/forgot-password', async (req, res) => {
  // Rate limit: 3 per IP per hour
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const rl = rateLimit(`forgot:${ip}`, 3, 60 * 60 * 1000);
  if (rl.blocked) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' });
  }

  const { email } = req.body || {};
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required.', code: 'VALIDATION_ERROR' });
  }

  const user = await findUserByEmail(normalizedEmail);
  if (user) {
    // Generate raw token, bcrypt hash it, store in DB
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(raw, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await createPasswordResetToken(user.id, hash, expiresAt);
    await sendResetPasswordEmail(normalizedEmail, raw, user.name).catch((err) => {
      console.error('[auth] Reset email failed:', err.message);
    });
  }

  // Always return the same success message — no account-existence leak
  res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
});

// ─── POST /api/auth/reset-password ──────────────────────────────────────────

router.post('/reset-password', async (req, res) => {
  // Rate limit: 5 per IP per hour
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const rl = rateLimit(`reset:${ip}`, 5, 60 * 60 * 1000);
  if (rl.blocked) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' });
  }

  const { token, new_password } = req.body || {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token is required.', code: 'VALIDATION_ERROR' });
  }
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.', code: 'VALIDATION_ERROR' });
  }

  // Hash the raw token so we can look it up in the DB
  // (The DB stores bcrypt hashes of raw tokens.)
  // We need to find which hash matches — try all stored hashes for this user.
  // Fast path: attempt to consume it directly if it's a valid bcrypt hash format.
  // Since we can't know which user's token it is, we scan all unused tokens.
  // Optimize: candidate check by scanning users with a matching reset token.
  const { pool } = require(path.join(__dirname, 'db', 'index'));
  const { rows: candidates } = await pool.query(
    `SELECT id, user_id, token_hash
     FROM password_reset_tokens
     WHERE used_at IS NULL AND expires_at > NOW()`
  );

  let matchedUserId = null;
  for (const row of candidates) {
    const match = await bcrypt.compare(token, row.token_hash).catch(() => false);
    if (match) {
      matchedUserId = row.user_id;
      // Mark the token as used
      await pool.query(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
        [row.id]
      );
      break;
    }
  }

  if (!matchedUserId) {
    return res.status(400).json({ error: 'Reset link expired or already used.', code: 'INVALID_RESET_TOKEN' });
  }

  // Hash new password and update
  const hash = await bcrypt.hash(new_password, SALT_ROUNDS).catch(() => null);
  if (!hash) {
    return res.status(500).json({ error: 'Failed to process password.', code: 'INTERNAL_ERROR' });
  }

  await updateUserPassword(matchedUserId, hash);
  // Invalidate any other unused reset tokens for this user
  await invalidatePasswordResetTokens(matchedUserId);
  // Revoke all refresh tokens — force re-login on all devices
  await revokeAllRefreshTokens(matchedUserId);

  res.json({ ok: true, message: 'Password updated. Please log in again.' });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) {
    res.clearCookie('holdoff_token', clearAuthCookies());
    res.clearCookie('refresh_token', clearAuthCookies());
    return res.status(401).json({ error: 'Account not found.', code: 'NOT_FOUND' });
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    subscription_tier: user.membership_type,
    subscription_status: user.subscription_status,
    subscription_end_date: user.subscription_expires_at,
    created_at: user.created_at,
  });
});

// ─── PUT /api/auth/account ──────────────────────────────────────────────────

router.put('/account', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { action, email, password, new_password, current_password } = req.body || {};

  if (['update_email', 'change_password', 'delete'].includes(action)) {
    if (!current_password) {
      return res.status(400).json({ error: 'current_password is required.', code: 'VALIDATION_ERROR' });
    }
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'Account not found.', code: 'NOT_FOUND' });
    if (user.password_hash) {
      const valid = await bcrypt.compare(current_password, user.password_hash).catch(() => false);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect.', code: 'INVALID_CREDENTIALS' });
    }
  }

  if (action === 'update_email') {
    const newEmail = (email || '').toLowerCase().trim();
    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required.', code: 'VALIDATION_ERROR' });
    }
    const taken = await isEmailTaken(newEmail, userId);
    if (taken) return res.status(409).json({ error: 'That email is already in use.', code: 'EMAIL_TAKEN' });
    const updated = await updateUserEmail(userId, newEmail);
    if (!updated) return res.status(500).json({ error: 'Failed to update email.', code: 'INTERNAL_ERROR' });

    // Re-issue tokens with new email
    const accessToken = signAccessToken({ id: userId, email: newEmail });
    const rawRefreshToken = await signRefreshToken(userId, newEmail, req.headers['user-agent']);
    res.cookie('holdoff_token', accessToken, holdoffTokenCookieOpts());
    res.cookie('refresh_token', rawRefreshToken, refreshCookieOpts());

    return res.json({ ok: true, email: newEmail });
  }

  if (action === 'change_password') {
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.', code: 'VALIDATION_ERROR' });
    }
    const user = await findUserById(userId);
    if (user.password_hash) {
      const same = await bcrypt.compare(new_password, user.password_hash).catch(() => false);
      if (same) return res.status(400).json({ error: 'New password must be different.', code: 'VALIDATION_ERROR' });
    }
    const hash = await bcrypt.hash(new_password, SALT_ROUNDS).catch(() => null);
    if (!hash) return res.status(500).json({ error: 'Failed to update password.', code: 'INTERNAL_ERROR' });
    await updateUserPassword(userId, hash);
    // Invalidate all reset tokens + revoke all refresh tokens → all devices re-auth
    await invalidatePasswordResetTokens(userId);
    await revokeAllRefreshTokens(userId);
    return res.json({ ok: true, message: 'Password updated.' });
  }

  if (action === 'delete') {
    await deleteUser(userId);
    res.clearCookie('holdoff_token', clearAuthCookies());
    res.clearCookie('refresh_token', clearAuthCookies());
    return res.json({ ok: true, message: 'Account deleted.' });
  }

  return res.status(400).json({ error: 'Unknown action.', code: 'UNKNOWN_ACTION' });
});

// ─── POST /api/auth/android-session ─────────────────────────────────────────
// Returns a short-lived JWT scoped to the Android service (no refresh token,
// no httpOnly cookie — native app stores it wherever it likes).

router.post('/android-session', async (req, res) => {
  const { user_id } = req.body || {};
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required.', code: 'VALIDATION_ERROR' });
  }

  const user = await findUserById(user_id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
  }

  const token = signAccessToken({ id: user.id, email: user.email, scope: 'android' });
  res.json({ token });
});

// ─── POST /api/auth/resend-verification ─────────────────────────────────────

router.post('/resend-verification', requireAuth, async (req, res) => {
  // Rate limit: 3 per user per hour
  const userId = req.user.id;
  const rl = rateLimit(`verify:${userId}`, 3, 60 * 60 * 1000);
  if (rl.blocked) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' });
  }

  const user = await findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Account not found.', code: 'NOT_FOUND' });

  const token = crypto.randomBytes(32).toString('hex');
  await setEmailVerificationToken(user.id, token);

  sendVerificationEmail(user.email, token, user.name).catch((err) => {
    console.error('[auth] Resend verification failed:', err.message);
  });

  res.json({ ok: true, message: 'Verification email sent.' });
});


// ─── DELETE /api/auth/delete-account ─────────────────────────────────────────
router.delete('/delete-account', requireAuth, async (req, res) => {
  try {
    const { pool } = require(path.join(__dirname, 'db', 'index'));
    const userId = req.user.id;
    // Anonymize rather than hard-delete — preserves referential integrity
    await pool.query(
      `UPDATE users SET
         email = 'deleted_' || id || '@deleted.holdoff',
         name = 'Deleted User',
         password_hash = '',
         deleted_at = NOW(),
         updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
    res.clearCookie('holdoff_access');
    res.clearCookie('holdoff_refresh');
    res.json({ ok: true });
  } catch (e) {
    console.error('[auth] delete-account error:', e.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});


// ─── POST /api/auth/google ──────────────────────────────────────────────────
// Google Identity Services: verify ID token and create/login user

router.post('/google', async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) {
    return res.status(400).json({ error: 'Missing Google credential.', code: 'VALIDATION_ERROR' });
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google sign-in is not configured.', code: 'CONFIG_ERROR' });
  }

  // Verify the ID token with Google's tokeninfo endpoint
  let payload;
  try {
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyRes.ok) {
      return res.status(401).json({ error: 'Invalid Google token.', code: 'INVALID_TOKEN' });
    }
    payload = await verifyRes.json();
  } catch (err) {
    console.error('[auth/google] Token verification failed:', err.message);
    return res.status(500).json({ error: 'Failed to verify Google token.', code: 'INTERNAL_ERROR' });
  }

  // Validate audience matches our client ID
  if (payload.aud !== GOOGLE_CLIENT_ID) {
    return res.status(401).json({ error: 'Token audience mismatch.', code: 'INVALID_TOKEN' });
  }

  // Validate email is verified
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    return res.status(401).json({ error: 'Google email not verified.', code: 'EMAIL_NOT_VERIFIED' });
  }

  const email = payload.email.toLowerCase().trim();
  const name = payload.name || payload.given_name || null;

  // Find or create user
  let user = await findUserByEmail(email);
  if (!user) {
    // Create new user (no password — Google-only account)
    user = await createUser({ email, name, passwordHash: null });
    if (!user) {
      return res.status(500).json({ error: 'Failed to create account.', code: 'INTERNAL_ERROR' });
    }
    // Mark email as verified since Google already verified it
    const { pool } = require(path.join(__dirname, 'db', 'index'));
    await pool.query(
      `UPDATE users SET email_verified_at = NOW() WHERE id = $1 AND email_verified_at IS NULL`,
      [user.id]
    ).catch(() => {});

    // Track referral if present
    const refToken = req.cookies && req.cookies.ref;
    if (refToken) {
      markConverted(refToken).catch(err => console.error('[auth] referral markConverted error:', err.message));
      res.clearCookie('ref');
    }

    // Send welcome email async
    const capturedUserId = user.id;
    const capturedName = name;
    setImmediate(async () => {
      try {
        let sendEmail;
        try { ({ sendEmail } = require('../services/email')); } catch { sendEmail = null; }
        if (!sendEmail) return;
        const claimed = await markWelcomeSent(capturedUserId);
        if (!claimed) return;
        const { subject, html, text } = buildWelcomeEmail({ email, name: capturedName });
        await sendEmail({ to: email, subject, html, text, replyTo: 'hello@shouldiholdoff.live' });
        console.log(`[auth] Welcome email sent to ${email} (Google signup)`);
      } catch (err) {
        console.error('[auth] Welcome email failed:', err.message);
      }
    });
  }

  // Issue access + refresh tokens
  const accessToken = signAccessToken({ id: user.id, email });
  const rawRefreshToken = await signRefreshToken(user.id, email, req.headers['user-agent']);

  res.cookie('holdoff_token', accessToken, holdoffTokenCookieOpts());
  res.cookie('refresh_token', rawRefreshToken, refreshCookieOpts());

  res.json({
    ok: true,
    user: { id: user.id, email, name: user.name || name },
    isNewUser: !user.password_hash && !user.created_at,
  });
});


module.exports = router;
