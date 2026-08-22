const { pool } = require('./index');

function calcStreak(lastVerdictAt) {
  if (!lastVerdictAt) return { currentStreak: 0, longestStreak: 0 };
  const now = new Date();
  const last = new Date(lastVerdictAt);
  const diffMs = now.getTime() - last.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours > 24) return { currentStreak: 0 };
  return null; // streak is still valid — don't override
}

async function recordVerdict({ userId, verdict, patternName, feedbackSnippet, attachmentStyle, source }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO verdict_history (user_id, verdict, pattern_name, feedback_snippet, attachment_style, source)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, verdict, patternName || null, feedbackSnippet || null, attachmentStyle || null, source || 'filter']
    );

    // Determine streak delta based on verdict type.
    // HOLD  → increment current streak (or start at 1)
    // SEND  → reset to 0 (they went ahead and sent it)
    // REWRITE → streak unchanged
    let streakVal;
    if (verdict === 'HOLD') {
      const { rows: [prev] } = await client.query(
        `SELECT current_streak, last_verdict_at FROM user_verdict_stats WHERE user_id = $1`,
        [userId]
      );
      if (!prev) {
        streakVal = 1;
      } else {
        const lastDate = prev.last_verdict_at
          ? new Date(prev.last_verdict_at).toISOString().slice(0, 10)
          : null;
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (lastDate === today) {
          streakVal = prev.current_streak; // already recorded today — no change
        } else if (lastDate === yesterday) {
          streakVal = prev.current_streak + 1; // consecutive day
        } else {
          streakVal = 1; // streak broken, start fresh
        }
      }
    } else if (verdict === 'SEND') {
      streakVal = 0; // they sent it — streak breaks
    } else {
      // REWRITE or any other verdict: preserve existing streak
      const { rows: [prev] } = await client.query(
        `SELECT current_streak FROM user_verdict_stats WHERE user_id = $1`,
        [userId]
      );
      streakVal = prev ? prev.current_streak : 0;
    }

    await client.query(
      `INSERT INTO user_verdict_stats (user_id, total_verdicts, last_verdict_at, current_streak, longest_streak, updated_at)
       VALUES ($1, 1, NOW(), $2, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         total_verdicts = user_verdict_stats.total_verdicts + 1,
         last_verdict_at = NOW(),
         current_streak = $2,
         longest_streak = GREATEST(user_verdict_stats.longest_streak, $2),
         updated_at = NOW()`,
      [userId, streakVal]
    );

    await client.query('COMMIT');
    return null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getVerdictHistory(userId, { verdictType, cursor, limit = 50 } = {}) {
  const params = [userId];
  let where = 'WHERE user_id = $1';
  let paramIdx = 2;

  if (verdictType) {
    where += ` AND verdict = $${paramIdx}`;
    params.push(verdictType);
    paramIdx++;
  }

  if (cursor) {
    where += ` AND created_at < $${paramIdx}`;
    params.push(cursor);
    paramIdx++;
  }

  const fetchLimit = Math.min(limit, 50);
  params.push(fetchLimit + 1);

  const { rows } = await pool.query(
    `SELECT id, verdict, pattern_name, feedback_snippet, attachment_style, source, created_at
     FROM verdict_history
     ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIdx}`,
    params
  );

  const hasMore = rows.length > fetchLimit;
  const entries = hasMore ? rows.slice(0, fetchLimit) : rows;
  const nextCursor = hasMore ? entries[entries.length - 1].created_at.toISOString() : null;

  return { entries, nextCursor, hasMore };
}

async function getStreak(userId) {
  const { rows } = await pool.query(
    `SELECT total_verdicts, current_streak, longest_streak, last_verdict_at, updated_at
     FROM user_verdict_stats WHERE user_id = $1`,
    [userId]
  );

  if (!rows.length) {
    return { currentStreak: 0, longestStreak: 0, totalVerdicts: 0, lastVerdictAt: null };
  }

  const row = rows[0];
  const fresh = calcStreak(row.last_verdict_at);

  return {
    currentStreak: fresh ? fresh.currentStreak : row.current_streak,
    longestStreak: row.longest_streak,
    totalVerdicts: row.total_verdicts,
    lastVerdictAt: row.last_verdict_at,
  };
}

async function getVerdictStats(userId) {
  const { rows } = await pool.query(
    `SELECT total_verdicts, current_streak, longest_streak, last_verdict_at, updated_at
     FROM user_verdict_stats WHERE user_id = $1`,
    [userId]
  );
  if (!rows.length) {
    return { totalVerdicts: 0, currentStreak: 0, longestStreak: 0, lastVerdictAt: null };
  }
  const row = rows[0];
  return {
    totalVerdicts: row.total_verdicts,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastVerdictAt: row.last_verdict_at,
  };
}

async function getTotalVerdictCount(userId) {
  const { rows } = await pool.query(
    `SELECT total_verdicts FROM user_verdict_stats WHERE user_id = $1`,
    [userId]
  );
  return rows.length ? rows[0].total_verdicts : 0;
}

async function getMatchHistory(userId) {
  const { rows } = await pool.query(
    `SELECT pattern_name,
            COUNT(*) as count,
            MAX(created_at) as last_at,
            (SELECT verdict FROM verdict_history v2
             WHERE v2.pattern_name = verdict_history.pattern_name
             GROUP BY verdict ORDER BY COUNT(*) DESC LIMIT 1) as top_verdict
     FROM verdict_history
     WHERE user_id = $1 AND pattern_name IS NOT NULL AND pattern_name != ''
     GROUP BY pattern_name
     ORDER BY count DESC
     LIMIT 20`,
    [userId]
  );
  return rows;
}

module.exports = {
  recordVerdict,
  getVerdictHistory,
  getStreak,
  getVerdictStats,
  getTotalVerdictCount,
  getMatchHistory,
  calcStreak,
};
