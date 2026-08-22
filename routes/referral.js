/**
 * Referral routes — peer-to-peer send-the-filter flow + referral dashboard.
 * Owns: POST /api/referral/send, GET /api/referral/dashboard, GET /api/referral/stats.
 * Does NOT own: DB pool, email transport, auth JWT logic.
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { verifyToken, getCookieTokens } = require('../lib/auth');
const { countTodaySends, createReferral, checkRewardTiers, getStatsWithHistory, getNextTierInfo, TIERS } = require('../db/referrals');
const { sendReferralEmail, sendRewardUnlockedEmail } = require('../services/referral-email');

const DAILY_LIMIT = 10;
const NOTE_MAX = 200;
const APP_URL = process.env.APP_URL || 'https://shouldiholdoff.live';

/** Generate a nanoid-style 10-char alphanumeric token. */
function makeToken() {
  return crypto.randomBytes(8).toString('base64url').slice(0, 10);
}

/** Basic email validation. */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Resolve sender identity from JWT or device cookie. Returns { email, name, deviceId }. */
function resolveSender(req) {
  let email = null;
  let name = null;
  const tokens = getCookieTokens(req);
  const jwtPayload = tokens.accessPayload || tokens.refreshPayload;
  if (jwtPayload?.id) {
    email = jwtPayload.email || null;
    name = jwtPayload.name || (email ? email.split('@')[0] : null);
  }

  // Device fingerprint from hf_vc cookie — stable anonymous ID for rate-limiting
  const cookieHeader = req.headers.cookie || '';
  const hfVc = cookieHeader.match(/hf_vc=([^;]+)/)?.[1] || null;
  const deviceId = hfVc
    ? crypto.createHash('sha256').update(hfVc + (req.ip || '')).digest('hex').slice(0, 16)
    : crypto.createHash('sha256').update((req.ip || 'anon') + (req.headers['user-agent'] || '')).digest('hex').slice(0, 16);

  return { email, name, deviceId };
}

/**
 * POST /api/referral/send
 * Body: { recipientEmail: string, note?: string, streakCount?: number }
 * Auth: optional JWT cookie (provides sender email + name). Falls back to device ID.
 */
router.post('/send', async (req, res) => {
  try {
    const { recipientEmail, note, streakCount } = req.body || {};

    if (!isValidEmail(recipientEmail)) {
      return res.status(400).json({ error: 'Valid recipient email required.' });
    }

    const { email: senderEmail, name: senderName, deviceId } = resolveSender(req);
    if (!senderEmail) {
      return res.status(400).json({ error: 'Must be logged in to send referrals.' });
    }

    // Rate-limit check — 10 sends per 24 hours per sender email
    const todayCount = await countTodaySends({ senderEmail, senderDevice: deviceId });
    if (todayCount >= DAILY_LIMIT) {
      return res.status(429).json({ error: 'daily_limit_reached', limit: DAILY_LIMIT });
    }

    const cleanNote = note && typeof note === 'string'
      ? note.trim().slice(0, NOTE_MAX)
      : null;

    const utmToken = makeToken();
    const streak = typeof streakCount === 'number' && streakCount > 0 ? streakCount : 0;

    // Store referral record
    await createReferral({
      senderEmail,
      senderDevice: deviceId,
      recipientEmail: recipientEmail.trim(),
      note: cleanNote,
      utmToken,
    });

    // Send email
    await sendReferralEmail({
      senderName,
      recipientEmail: recipientEmail.trim(),
      note: cleanNote,
      utmToken,
      streakCount: streak,
    });

    return res.json({
      ok: true,
      remaining: DAILY_LIMIT - todayCount - 1,
      referralUrl: `${APP_URL}/filter?ref=${utmToken}`,
    });

  } catch (err) {
    console.error('[referral] send error:', err?.message);
    return res.status(500).json({ error: 'Could not send referral. Try again.' });
  }
});

/**
 * GET /api/referral/dashboard
 * Auth: JWT required (sender email from access/refresh token).
 * Returns: referral link, stats, reward history, next tier info.
 */
router.get('/dashboard', async (req, res) => {
  try {
    const tokens = getCookieTokens(req);
    const jwtPayload = tokens.accessPayload || tokens.refreshPayload;
    if (!jwtPayload?.id || !jwtPayload?.email) {
      return res.status(401).json({ error: 'Login required.' });
    }

    const senderEmail = jwtPayload.email;
    const { stats, history } = await getStatsWithHistory(senderEmail);
    const nextTier = await getNextTierInfo(senderEmail);

    // Generate unique referral link — token is the user's email hash (stable across sessions)
    const userToken = crypto.createHash('sha256').update(senderEmail.toLowerCase().trim()).digest('hex').slice(0, 12);
    const referralUrl = `${APP_URL}/filter?ref=${userToken}`;

    // Channel breakdown: count by referral source from the referrals table
    const { pool } = require('../db/index');
    const channelBreakdown = await pool.query(
      `SELECT sender_email, COUNT(*) AS total, COUNT(converted_at) AS converted
       FROM referrals WHERE sender_email = $1
       GROUP BY sender_email`,
      [senderEmail]
    );

    return res.json({
      referralUrl,
      userToken,
      stats: {
        dailySendCount: stats.daily_send_count,
        totalReferrals: stats.total_referrals,
        totalConverted: stats.total_converted,
        rewardCredits: stats.reward_credits,
        trialDaysGranted: stats.trial_days_granted,
        lifetimeUnlocked: stats.lifetime_unlocked,
      },
      tiers: Object.entries(TIERS).map(([id, t]) => ({
        id,
        label: t.label,
        rewardLabel: t.rewardLabel,
        threshold: t.threshold,
        unlocked: history.some(h => h.tier === id),
      })),
      history: history.map(h => ({
        tier: h.tier,
        rewardType: h.reward_type,
        rewardValue: h.reward_value,
        referralCount: h.referral_count,
        unlockedAt: h.unlocked_at,
      })),
      nextTier,
    });
  } catch (err) {
    console.error('[referral] dashboard error:', err?.message);
    return res.status(500).json({ error: 'Could not load dashboard.' });
  }
});

/**
 * GET /api/referral/stats
 * Lightweight endpoint for filter page to show referral progress.
 * Auth: JWT required.
 */
router.get('/stats', async (req, res) => {
  try {
    const tokens = getCookieTokens(req);
    const jwtPayload = tokens.accessPayload || tokens.refreshPayload;
    if (!jwtPayload?.id || !jwtPayload?.email) {
      return res.json({ loggedIn: false });
    }

    const senderEmail = jwtPayload.email;
    const { stats, history } = await getStatsWithHistory(senderEmail);
    const nextTier = await getNextTierInfo(senderEmail);
    const userToken = crypto.createHash('sha256').update(senderEmail.toLowerCase().trim()).digest('hex').slice(0, 12);

    return res.json({
      loggedIn: true,
      totalConverted: stats.total_converted,
      rewardCredits: stats.reward_credits,
      trialDaysGranted: stats.trial_days_granted,
      lifetimeUnlocked: stats.lifetime_unlocked,
      history: history.map(h => ({ tier: h.tier, rewardType: h.reward_type, rewardValue: h.reward_value })),
      nextTier,
      referralUrl: `${APP_URL}/filter?ref=${userToken}`,
    });
  } catch (err) {
    console.error('[referral] stats error:', err?.message);
    return res.status(500).json({ error: 'Could not load stats.' });
  }
});

module.exports = router;