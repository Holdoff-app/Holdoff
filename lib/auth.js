/**
 * JWT auth utilities — token generation, verification, and Express middleware.
 * Owns: JWT signing/verification, requireAuth middleware, cookie helpers.
 * Does NOT own: user DB queries, password hashing, route handlers.
 *
 * Auth strategy:
 *  - Access token: JWT (7 days), stored in httpOnly holdoff_token cookie + optional Bearer header
 *  - Refresh token: opaque 64-char hex, bcrypt-hashed in DB, stored in httpOnly cookie only
 *  - Silent refresh: when access token is expired and refresh cookie is valid, auto-issue new access token
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
} = require('../db/auth-tokens');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || null;
const AUTH_CONFIG_ERROR = !JWT_SECRET
  ? '[auth] JWT_SECRET is not set. Starting in public-only degraded mode; login, signup, and protected auth features stay disabled until a 32+ character secret is configured.'
  : JWT_SECRET.length < 32
    ? '[auth] JWT_SECRET is too short. Starting in public-only degraded mode until a cryptographically random secret of at least 32 characters is configured.'
    : null;

if (AUTH_CONFIG_ERROR) {
  console.warn(AUTH_CONFIG_ERROR);
}
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || '7d';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL || '7d';

function isAuthConfigured() {
  return !AUTH_CONFIG_ERROR;
}

function authUnavailableError() {
  const err = new Error('Authentication is unavailable until JWT_SECRET is configured to a cryptographically random value of at least 32 characters.');
  err.code = 'AUTH_UNAVAILABLE';
  err.status = 503;
  return err;
}

function assertAuthConfigured() {
  if (!isAuthConfigured()) {
    throw authUnavailableError();
  }
}

// ─── Token signing ─────────────────────────────────────────────────────────

/** Sign an access token (short-lived JWT). */
function signAccessToken(payload) {
  assertAuthConfigured();
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

/**
 * Create, store, and return an opaque refresh token.
 *
 * Generates a random 64-char hex token, bcrypt-hashes it, stores the hash in
 * auth_refresh_tokens, and returns the raw token to the caller. The raw token
 * is stored in an httpOnly cookie — only the hash ever touches the DB.
 *
 * Caller is responsible for setting the cookie with the returned raw token.
 */
async function signRefreshToken(userId, email, userAgent) {
  assertAuthConfigured();
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = await bcrypt.hash(raw, 10);
  const expiresAt = new Date(Date.now() + ms(REFRESH_TOKEN_TTL));
  await createRefreshToken(userId, hash, expiresAt, userAgent);
  return raw;
}

/**
 * Verify a JWT and return the payload.
 * Returns null if invalid or expired.
 */
function verifyToken(token) {
  if (!isAuthConfigured()) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ─── Token extraction ─────────────────────────────────────────────────────────

/**
 * Extract Bearer JWT from Authorization header.
 * Returns decoded payload or null.
 */
function getBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

/**
 * Read raw refresh token from cookie, hash it, and look up in DB.
 * Returns { userId, email } from the matching auth_refresh_tokens row, or null.
 */
async function getRefreshTokenFromCookie(req) {
  if (!isAuthConfigured()) return null;
  const raw = req.cookies?.refresh_token;
  if (!raw || typeof raw !== 'string') return null;

  // All active tokens for this user (will check expiry below)
  const { pool } = require('../db/index');
  const { rows } = await pool.query(
    `SELECT id, user_id, token_hash, expires_at
     FROM auth_refresh_tokens
     WHERE revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`
  );

  for (const row of rows) {
    const match = await bcrypt.compare(raw, row.token_hash);
    if (match) {
      // Look up user email from users table
      const userRows = await pool.query(
        'SELECT email FROM users WHERE id = $1',
        [row.user_id]
      );
      if (userRows.rows[0]) {
        return {
          userId: row.user_id,
          email: userRows.rows[0].email,
          tokenId: row.id,
        };
      }
    }
  }
  return null;
}

/**
 * Read access token from cookie (JWT).
 * Returns decoded payload or null.
 */
function getAccessTokenFromCookie(req) {
  const token = req.cookies?.holdoff_token;
  return token ? verifyToken(token) : null;
}

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * Express middleware: require an authenticated user.
 *
 * Supports three modes, checked in order:
 *  1. Valid Bearer JWT in Authorization header → immediate success
 *  2. Valid access cookie JWT → immediate success
 *  3. Expired access cookie + valid refresh cookie → silent refresh (sets new access
 *     cookie + res.locals.newAccessToken); caller should read that field.
 *
 * On failure (no valid auth found), returns 401 with { error, code }.
 * Sets req.user = { id, email } on success.
 */
async function requireAuth(req, res, next) {
  if (!isAuthConfigured()) {
    return res.status(503).json({
      error: 'Authentication is unavailable until JWT_SECRET is configured.',
      code: 'AUTH_UNAVAILABLE',
    });
  }
  let payload = null;
  let source = null;

  // Mode 1: Bearer JWT
  const bearer = getBearerToken(req);
  if (bearer?.id) {
    payload = bearer;
    source = 'bearer';
  }

  // Mode 2: access cookie JWT
  if (!payload) {
    const accessPayload = getAccessTokenFromCookie(req);
    if (accessPayload?.id) {
      payload = accessPayload;
      source = 'cookie';
    }
  }

  // Mode 3: expired access cookie + valid refresh cookie → silent refresh
  if (!payload) {
    const accessPayload = getAccessTokenFromCookie(req);
    if (accessPayload && !accessPayload.id) {
      // Access token expired or malformed — check for refresh cookie
      const refreshData = await getRefreshTokenFromCookie(req);
      if (refreshData?.userId) {
        const newAccessToken = signAccessToken({ id: refreshData.userId, email: refreshData.email });
        res.cookie('holdoff_token', newAccessToken, accessCookieOpts());
        res.locals.newAccessToken = newAccessToken;
        req.user = { id: refreshData.userId, email: refreshData.email };
        return next();
      }
    }
  }

  if (!payload || !payload.id) {
    return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' });
  }

  req.user = { id: payload.id, email: payload.email };
  next();
}

/**
 * Optional auth middleware — sets req.user if valid credentials are present,
 * but does NOT block if absent. Use for pages that adapt based on auth state.
 */
async function optionalAuth(req, res, next) {
  if (!isAuthConfigured()) {
    return next();
  }
  let payload = null;

  const bearer = getBearerToken(req);
  if (bearer?.id) {
    payload = bearer;
  } else {
    const accessPayload = getAccessTokenFromCookie(req);
    if (accessPayload?.id) {
      payload = accessPayload;
    } else {
      // Only fall back to refresh token if access token is missing/expired
      const refreshData = await getRefreshTokenFromCookie(req);
      if (refreshData?.userId) {
        payload = { id: refreshData.userId, email: refreshData.email };
      }
    }
  }

  if (payload?.id) {
    req.user = { id: payload.id, email: payload.email };
  }
  next();
}

// ─── Cookie options ─────────────────────────────────────────────────────────

/** Cookie options for holdoff_token — 7 days, httpOnly. */
function holdoffTokenCookieOpts(maxAgeMs) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeMs || ms('7d'),
  };
}

/** Cookie options for refresh token — 7 days, httpOnly. */
function refreshCookieOpts(maxAgeMs) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeMs || ms('7d'),
  };
}

/** Clear both auth cookies (for logout). */
function clearAuthCookies() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Convert a human-readable TTL string ('15m', '7d') to milliseconds. */
function ms(str) {
  const map = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  const m = str.match(/^(\d+)([smhd])$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * map[m[2]];
}

/**
 * Read access token from cookie and refresh token from cookie.
 * Returns { accessPayload, refreshPayload } — either may be null.
 */
function getCookieTokens(req) {
  if (!isAuthConfigured()) {
    return {
      accessPayload: null,
      refreshPayload: null,
    };
  }
  return {
    accessPayload: getAccessTokenFromCookie(req),
    refreshPayload: getRefreshTokenFromCookie(req),
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  getBearerToken,
  getCookieTokens,
  getRefreshTokenFromCookie,
  getAccessTokenFromCookie,
  isAuthConfigured,
  assertAuthConfigured,
  requireAuth,
  withAuth: requireAuth,
  optionalAuth,
  accessCookieOpts: holdoffTokenCookieOpts,
  holdoffTokenCookieOpts,
  refreshCookieOpts,
  clearAuthCookies,
};
