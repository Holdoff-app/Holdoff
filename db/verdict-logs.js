/**
 * Verdict-logs DB module — enriched per-verdict analytics for the pattern journal.
 * Owns: verdict_logs table (user_id, message_length, attachment_style_snapshot).
 * Does NOT own: verdict_history (verdict type, pattern, etc.), user_verdict_stats streak.
 */
const { pool } = require('./index');

/**
 * Log a verdict with user context and message metadata.
 * Called after every successful /api/verdict response.
 */
async function logVerdictWithContext({ userId, messageLength, attachmentStyleSnapshot }) {
  if (!userId) return;
  await pool.query(
    `INSERT INTO verdict_logs (user_id, message_length, attachment_style_snapshot, verdict_source, verdict, latency_ms)
     VALUES ($1, $2, $3, NULL, NULL, NULL)`,
    [userId, messageLength ?? null, attachmentStyleSnapshot ?? null]
  );
}

/**
 * Get verdict log count for a user (total verdicts ever submitted).
 */
async function getVerdictLogCount(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count FROM verdict_logs WHERE user_id = $1`,
    [userId]
  );
  return parseInt(rows[0]?.count || '0', 10);
}

module.exports = { logVerdictWithContext, getVerdictLogCount };