/**
 * Referrals DB queries.
 * Owns: referrals table + user_referral_stats + referral_rewards reads/writes.
 * Does NOT own: email sending, route logic, token generation.
 */
const { pool } = require('./index');

/**
 * Count referrals sent today by sender (email or device).
 * Resets at midnight local time — uses a midnight-snap lookup on daily_reset_at.
 */
async function countTodaySends({ senderEmail, senderDevice }) {
  const col = senderEmail ? 'sender_email' : 'sender_device';
  const val = senderEmail ? senderEmail.toLowerCase().trim() : senderDevice;

  // Midnight-snapped daily counter — rolls over at midnight local time.
  // Query counts referrals with created_at >= today's midnight.
  const result = await pool.query(
    `SELECT COUNT(*) AS cnt FROM referrals
     WHERE ${col} = $1
       AND created_at >= (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamptz`,
    [val]
  );
  return parseInt(result.rows[0].cnt, 10);
}

/**
 * Increment daily_send_count for a sender, resetting at midnight.
 * Called inside a transaction after a successful send.
 */
async function incrementDailyCount(senderEmail) {
  const email = senderEmail.toLowerCase().trim();
  await pool.query(
    `INSERT INTO user_referral_stats (sender_email, daily_send_count, daily_reset_at)
     VALUES ($1, 1, (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamptz)
     ON CONFLICT (sender_email) DO UPDATE
       SET daily_send_count = CASE
         WHEN (user_referral_stats.daily_reset_at AT TIME ZONE 'America/Los_Angeles')::date
              < CURRENT_DATE AT TIME ZONE 'America/Los_Angeles'::date
         THEN 1
         ELSE user_referral_stats.daily_send_count + 1
       END,
       daily_reset_at = (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamptz`,
    [email]
  );
}

/**
 * Insert a referral record. Caller is responsible for updating
 * sender's total_referrals and daily_send_count separately.
 */
async function createReferral({ senderEmail, senderDevice, recipientEmail, note, utmToken }) {
  const result = await pool.query(
    `INSERT INTO referrals (sender_email, sender_device, recipient_email, note, utm_token)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, utm_token, created_at`,
    [
      senderEmail ? senderEmail.toLowerCase().trim() : null,
      senderDevice || null,
      recipientEmail.toLowerCase().trim(),
      note || null,
      utmToken,
    ]
  );
  return result.rows[0];
}

/**
 * Increment total_referrals and daily_send_count for a sender.
 * daily_send_count resets at midnight PT.
 */
async function incrementStats(senderEmail) {
  if (!senderEmail) return;
  const email = senderEmail.toLowerCase().trim();
  await pool.query(
    `INSERT INTO user_referral_stats (sender_email, total_referrals, daily_send_count, daily_reset_at)
     VALUES ($1, 1, 1, (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamptz)
     ON CONFLICT (sender_email) DO UPDATE
       SET total_referrals = user_referral_stats.total_referrals + 1,
           daily_send_count = CASE
             WHEN (user_referral_stats.daily_reset_at AT TIME ZONE 'America/Los_Angeles')::date
                  < CURRENT_DATE AT TIME ZONE 'America/Los_Angeles'::date
             THEN 1
             ELSE user_referral_stats.daily_send_count + 1
           END,
           daily_reset_at = (CURRENT_DATE AT TIME ZONE 'America/Los_Angeles')::timestamptz`,
    [email]
  );
}

/**
 * Mark a referral as converted (signup or Pro purchase).
 * Called when a ref= token is seen at signup or checkout.
 * Also increments the sender's converted count in user_referral_stats.
 */
async function markConverted(utmToken) {
  await pool.query(
    `UPDATE referrals SET converted_at = NOW()
     WHERE utm_token = $1 AND converted_at IS NULL`,
    [utmToken]
  );
  // Update sender's converted count
  await pool.query(
    `UPDATE user_referral_stats
     SET total_converted = total_converted + 1,
         updated_at = NOW()
     WHERE sender_email = (
       SELECT sender_email FROM referrals WHERE utm_token = $1 LIMIT 1
     )`,
    [utmToken]
  );
}

/**
 * Look up referral by utm_token. Returns row or null.
 */
async function getReferralByToken(utmToken) {
  const result = await pool.query(
    'SELECT * FROM referrals WHERE utm_token = $1',
    [utmToken]
  );
  return result.rows[0] || null;
}

// ── Tiered reward system ───────────────────────────────────────────────────────

/** Referral reward tier definitions. Key = tier id, Value = threshold (total converted). */
const TIERS = {
  tier1: { threshold: 1,  rewardCredits: 1,  trialDays: 0,  lifetime: false, label: '1 Referral', rewardLabel: '+1 free verdict' },
  tier2: { threshold: 5,  rewardCredits: 5,  trialDays: 0,  lifetime: false, label: '5 Referrals', rewardLabel: '+5 free verdicts' },
  tier3: { threshold: 10, rewardCredits: 30, trialDays: 7, lifetime: false, label: '10 Referrals', rewardLabel: '+30 free verdicts or 1-week Pro trial' },
  tier4: { threshold: 25, rewardCredits: 0,  trialDays: 0,  lifetime: true,  label: '25 Referrals', rewardLabel: 'Lifetime HoldOff Pro' },
};

/** Get or create user_referral_stats row for a sender email. */
async function getOrCreateStats(senderEmail) {
  const email = senderEmail.toLowerCase().trim();
  const result = await pool.query(
    `INSERT INTO user_referral_stats (sender_email)
     VALUES ($1)
     ON CONFLICT (sender_email) DO UPDATE SET sender_email = EXCLUDED.sender_email
     RETURNING *`,
    [email]
  );
  return result.rows[0];
}

/**
 * Check if a new referral has unlocked a reward tier.
 * Returns { unlockedTiers: [...], rewardCredits: total, trialDays: total, lifetime: bool }
 */
async function checkRewardTiers(senderEmail) {
  const email = senderEmail.toLowerCase().trim();

  // Get current stats
  const stats = await getOrCreateStats(email);
  const converted = stats.total_converted;

  // Get already-unlocked tiers
  const unlocked = await pool.query(
    'SELECT tier FROM referral_rewards WHERE sender_email = $1',
    [email]
  );
  const unlockedSet = new Set(unlocked.rows.map(r => r.tier));

  const newlyUnlocked = [];
  for (const [tierId, tierDef] of Object.entries(TIERS)) {
    if (!unlockedSet.has(tierId) && converted >= tierDef.threshold) {
      newlyUnlocked.push(tierId);
    }
  }

  if (newlyUnlocked.length === 0) return { unlockedTiers: [], rewardCredits: 0, trialDays: 0, lifetime: false };

  // Record each newly unlocked tier
  const inserted = [];
  for (const tierId of newlyUnlocked) {
    const t = TIERS[tierId];
    await pool.query(
      `INSERT INTO referral_rewards (sender_email, tier, reward_type, reward_value, referral_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, tierId, t.lifetime ? 'lifetime' : (t.trialDays > 0 ? 'trial_days' : 'verdict_credits'),
       t.lifetime ? 1 : (t.trialDays > 0 ? t.trialDays : t.rewardCredits), converted]
    );
    inserted.push(tierId);
  }

  // Update stats with reward credits and trial days
  const totalCredits = inserted.reduce((s, tid) => s + TIERS[tid].rewardCredits, 0);
  const totalTrial  = inserted.reduce((s, tid) => s + TIERS[tid].trialDays, 0);
  const hasLifetime = inserted.includes('tier4');

  await pool.query(
    `UPDATE user_referral_stats SET
       reward_credits = reward_credits + $1,
       trial_days_granted = trial_days_granted + $2,
       lifetime_unlocked = COALESCE(lifetime_unlocked, false) OR $3,
       updated_at = NOW()
     WHERE sender_email = $4`,
    [totalCredits, totalTrial, hasLifetime, email]
  );

  return {
    unlockedTiers: inserted,
    rewardCredits: totalCredits,
    trialDays: totalTrial,
    lifetime: hasLifetime,
  };
}

/** Get full stats + reward history for a sender email. */
async function getStatsWithHistory(senderEmail) {
  const email = senderEmail.toLowerCase().trim();
  const [statsRows, historyRows] = await Promise.all([
    pool.query('SELECT * FROM user_referral_stats WHERE sender_email = $1', [email]),
    pool.query(
      'SELECT tier, reward_type, reward_value, referral_count, unlocked_at FROM referral_rewards WHERE sender_email = $1 ORDER BY unlocked_at ASC',
      [email]
    ),
  ]);
  const stats = statsRows.rows[0] || {
    sender_email: email,
    daily_send_count: 0,
    total_referrals: 0,
    total_converted: 0,
    reward_credits: 0,
    trial_days_granted: 0,
    lifetime_unlocked: false,
  };
  return { stats, history: historyRows.rows };
}

/** Get the next tier threshold for a sender email. Returns null if fully unlocked. */
async function getNextTierInfo(senderEmail) {
  const email = senderEmail.toLowerCase().trim();
  const stats = await getOrCreateStats(email);
  const converted = stats.total_converted;
  const unlocked = await pool.query('SELECT tier FROM referral_rewards WHERE sender_email = $1', [email]);
  const unlockedSet = new Set(unlocked.rows.map(r => r.tier));

  for (const [tierId, tierDef] of Object.entries(TIERS)) {
    if (!unlockedSet.has(tierId)) {
      const remaining = tierDef.threshold - converted;
      return { tierId, label: tierDef.label, remaining, rewardLabel: tierDef.rewardLabel };
    }
  }
  return null; // all tiers unlocked
}

module.exports = {
  countTodaySends, createReferral, markConverted, getReferralByToken,
  getOrCreateStats, checkRewardTiers, getStatsWithHistory, getNextTierInfo, TIERS,
};
