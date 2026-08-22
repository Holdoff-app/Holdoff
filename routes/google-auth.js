/**
 * POST /api/auth/google — Google One Tap / Sign-In handler.
 * Verifies the Google ID token, finds or creates user, issues JWT cookies.
 */
const { OAuth2Client } = require('google-auth-library');
const { findUserByEmail, createUser } = require('../db/users');
const { signAccessToken, signRefreshToken, holdoffTokenCookieOpts, refreshCookieOpts } = require('../lib/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { isCapabilityAvailable } = require('../config/dependency-policy');

module.exports = async function googleAuthHandler(req, res) {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'No credential provided' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || !isCapabilityAvailable('auth.google')) {
      return res.status(503).json({ success: false, error: 'Google sign-in temporarily unavailable. Use email sign-in.' });
    }

    // Verify Google ID token
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ success: false, error: 'No email in Google account' });
    }

    // Find or create user
    let user = await findUserByEmail(email).catch(() => null);

    if (!user) {
      // Create new user — hash a random password since they'll use Google login
      const randomPass = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPass, 10);
      user = await createUser({
        email,
        name: name || email.split('@')[0],
        passwordHash,
      });
      if (!user) {
        // ON CONFLICT DO NOTHING returned null — email already exists (race)
        user = await findUserByEmail(email);
      }
    }

    if (!user || !user.id) {
      return res.status(500).json({ success: false, error: 'Failed to create account' });
    }

    // Issue tokens
    const accessToken = signAccessToken({ id: user.id, email: user.email });
    const refreshToken = await signRefreshToken(user.id, user.email, req.headers['user-agent'] || 'google-auth');

    // Set auth cookies
    res.cookie('holdoff_token', accessToken, holdoffTokenCookieOpts());
    res.cookie('refresh_token', refreshToken, refreshCookieOpts());

    return res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('[google-auth] Error:', err.message);
    return res.status(401).json({ success: false, error: 'Google authentication failed' });
  }
};
