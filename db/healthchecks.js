/**
 * Healthchecks DB module. Owns: verdict API probe log writes + reads.
 * Does NOT own: alert sending, probe HTTP logic, email delivery.
 */
const { pool } = require('./index');

/**
 * Log one probe result to the healthchecks table.
 * status: 'ok' | 'down'
 */
async function logHealthCheck({ status, responseTimeMs, httpStatus, bodySnippet, errorMessage }) {
  await pool.query(
    `INSERT INTO healthchecks
       (status, response_time_ms, http_status, body_snippet, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [status, responseTimeMs ?? null, httpStatus ?? null, bodySnippet ?? null, errorMessage ?? null]
  );
}

/**
 * Return the most recent N healthcheck rows, newest first.
 */
async function getRecentHealthChecks(limit = 100) {
  const result = await pool.query(
    `SELECT * FROM healthchecks ORDER BY checked_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Return the last probe row (to detect status transitions for RECOVERED emails).
 */
async function getLastHealthCheck() {
  const result = await pool.query(
    `SELECT * FROM healthchecks ORDER BY checked_at DESC LIMIT 1`
  );
  return result.rows[0] || null;
}

/**
 * Return the most recent 'down' row where an alert was fired,
 * used for 15-min debounce logic.
 */
async function getLastDownCheck() {
  const result = await pool.query(
    `SELECT * FROM healthchecks WHERE status = 'down' ORDER BY checked_at DESC LIMIT 1`
  );
  return result.rows[0] || null;
}

/**
 * Return the second-most-recent 'down' row (index 1 when ordered DESC),
 * used to debounce repeated DOWN alerts. The most-recent down is the current run.
 */
async function getPrevDownCheck() {
  const result = await pool.query(
    `SELECT * FROM healthchecks WHERE status = 'down' ORDER BY checked_at DESC LIMIT 2`
  );
  return result.rows[1] || null;
}

/**
 * Return the status of the row just before the most-recent one,
 * used to detect ok→down or down→ok transitions.
 * Returns null if fewer than 2 rows exist.
 */
async function getPrevStatus() {
  const result = await pool.query(
    `SELECT status FROM healthchecks ORDER BY checked_at DESC LIMIT 2`
  );
  return result.rows[1]?.status || null;
}

/**
 * Log one site-check result to the healthchecks table.
 * status: 'site_check'
 * checks: array of { name, ok, responseTimeMs, httpStatus, errorMessage }
 */
async function logSiteCheck({ passed, checks, summary }) {
  const status = 'site_check';
  const bodySnippet = summary;
  await pool.query(
    `INSERT INTO healthchecks (status, body_snippet) VALUES ($1, $2)`,
    [status, bodySnippet]
  );
}

/**
 * Return the most recent site_check row, used for debounce logic.
 */
async function getPrevSiteCheck() {
  const result = await pool.query(
    `SELECT * FROM healthchecks WHERE status = 'site_check' ORDER BY checked_at DESC LIMIT 1`
  );
  return result.rows[0] || null;
}

/**
 * Log one verdict API call to verdict_logs for source + latency observability.
 * verdictSource: 'proxy' | 'direct_anthropic' | 'direct_openai' | 'fallback'
 */
async function logVerdictCall({ verdictSource, verdict, latencyMs, errorMessage }) {
  await pool.query(
    `INSERT INTO verdict_logs (verdict_source, verdict, latency_ms, error_message)
     VALUES ($1, $2, $3, $4)`,
    [verdictSource, verdict ?? null, latencyMs ?? null, errorMessage ?? null]
  );
}

module.exports = {
  logHealthCheck,
  getRecentHealthChecks,
  getLastHealthCheck,
  getLastDownCheck,
  getPrevDownCheck,
  getPrevStatus,
  logVerdictCall,
  logSiteCheck,
  getPrevSiteCheck,
};
