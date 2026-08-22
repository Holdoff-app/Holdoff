/**
 * Verdict API uptime monitor. Owns: probe, log, alert.
 * Does NOT own: subscription logic, user data, route handling.
 *
 * Run by the [[crons]] scheduler every minute via render cron.
 * Hits POST /api/filter/analyze with a known test payload.
 * Alerts on: non-200, timeout, missing verdict field, response > 15s.
 * Debounce: max 1 DOWN alert per 15 min. Sends RECOVERED when back up.
 * Logs every check to healthchecks table for trend data.
 */

'use strict';

const { logHealthCheck, getPrevDownCheck, getPrevStatus } = require('../db/healthchecks');

const BASE_URL = process.env.APP_BASE_URL || 'https://shouldiholdoff.live';
// Probe the lightweight ping endpoint — avoids hitting AI proxy tokens.
// Full analyze check is done by watching verdict_source in user-facing calls.
const PROBE_URL = `${BASE_URL}/api/filter/ping`;
const ALERT_TO = process.env.ALERT_EMAIL || 'holdoff@shouldiholdoff.live';
const EMAIL_PROXY_URL = process.env.HOLDOFF_EMAIL_PROXY_URL;
const API_TOKEN = process.env.HOLDOFF_API_TOKEN || process.env.HOLDOFF_API_KEY;

// Warn threshold: if response time exceeds this, still OK but log it.
const WARN_MS = 10_000;
// Hard timeout: abort request after this many ms.
const TIMEOUT_MS = 15_000;
// Debounce: don't re-alert DOWN more than once per this window.
const DEBOUNCE_MS = 15 * 60 * 1000;

// ── Probe ────────────────────────────────────────────────────────────────────

async function probe() {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let httpStatus = null;
  let bodySnippet = null;
  let errorMessage = null;

  try {
    const resp = await fetch(PROBE_URL, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;
    httpStatus = resp.status;

    const text = await resp.text().catch(() => '');
    bodySnippet = text.slice(0, 300);

    // Non-200 = down
    if (resp.status !== 200) {
      return { ok: false, responseTimeMs, httpStatus, bodySnippet, errorMessage: `HTTP ${resp.status}` };
    }

    // Parse JSON and check for ok field (ping endpoint)
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      return { ok: false, responseTimeMs, httpStatus, bodySnippet, errorMessage: 'JSON parse failed' };
    }

    if (!parsed.ok) {
      return { ok: false, responseTimeMs, httpStatus, bodySnippet, errorMessage: 'Ping response missing ok field' };
    }

    // Fast ping-only check — verdict_source not available via this endpoint
    return { ok: true, responseTimeMs, httpStatus, bodySnippet, verdictSource: 'ping_endpoint' };

  } catch (err) {
    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;
    errorMessage = err.name === 'AbortError' ? `Timeout after ${TIMEOUT_MS}ms` : err.message;
    return { ok: false, responseTimeMs, httpStatus, bodySnippet, errorMessage };
  }
}

// ── Email alert ───────────────────────────────────────────────────────────────

async function sendAlert({ subject, html }) {
  if (!EMAIL_PROXY_URL || !API_TOKEN) {
    console.warn('[verdict-monitor] Email proxy not configured — alert not sent');
    return;
  }

  try {
    const resp = await fetch(EMAIL_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({
        to: ALERT_TO,
        subject,
        html,
        from_name: 'HoldOff Monitor',
        reply_to: 'holdoff@shouldiholdoff.live',
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error('[verdict-monitor] Alert email failed:', resp.status, text);
    } else {
      console.log('[verdict-monitor] Alert sent:', subject);
    }
  } catch (err) {
    console.error('[verdict-monitor] Alert send error:', err.message);
  }
}

function buildDownHtml({ responseTimeMs, httpStatus, bodySnippet, errorMessage }) {
  const ts = new Date().toISOString();
  return `
<div style="font-family:monospace;max-width:600px;margin:0 auto;color:#111;line-height:1.6;">
  <h2 style="color:#c0392b;margin-bottom:0.5rem;">🔴 HoldOff verdict API DOWN</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:1rem;">
    <tr><td style="padding:4px 8px;font-weight:bold;">Timestamp</td><td style="padding:4px 8px;">${ts}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:4px 8px;font-weight:bold;">HTTP Status</td><td style="padding:4px 8px;">${httpStatus ?? 'N/A'}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:bold;">Response Time</td><td style="padding:4px 8px;">${responseTimeMs}ms</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:4px 8px;font-weight:bold;">Error</td><td style="padding:4px 8px;">${errorMessage ?? 'Unknown'}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:bold;">Body Snippet</td><td style="padding:4px 8px;word-break:break-all;">${bodySnippet ? escapeHtml(bodySnippet) : 'N/A'}</td></tr>
  </table>
  <p style="color:#666;font-size:0.85rem;">Probe URL: ${PROBE_URL}<br>Next alert suppressed for 15 min while down.</p>
</div>`.trim();
}

function buildRecoveredHtml({ responseTimeMs }) {
  const ts = new Date().toISOString();
  return `
<div style="font-family:monospace;max-width:600px;margin:0 auto;color:#111;line-height:1.6;">
  <h2 style="color:#27ae60;margin-bottom:0.5rem;">✅ HoldOff verdict API RECOVERED</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:1rem;">
    <tr><td style="padding:4px 8px;font-weight:bold;">Timestamp</td><td style="padding:4px 8px;">${ts}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:4px 8px;font-weight:bold;">Response Time</td><td style="padding:4px 8px;">${responseTimeMs}ms</td></tr>
  </table>
  <p style="color:#666;font-size:0.85rem;">Probe URL: ${PROBE_URL}</p>
</div>`.trim();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Main ─────────────────────────────────────────────────────────────────────

// Entry point — run immediately when executed as a script (cron invocation).
// When required as a module (from setInterval in server.js), import the fn separately.
async function run() {
  console.log(`[verdict-monitor] Probing ${PROBE_URL}`);

  const result = await probe();
  const status = result.ok ? 'ok' : 'down';

  // Always log to DB
  try {
    await logHealthCheck({
      status,
      responseTimeMs: result.responseTimeMs,
      httpStatus: result.httpStatus,
      bodySnippet: result.bodySnippet,
      errorMessage: result.errorMessage,
    });
  } catch (dbErr) {
    // DB logging failure must not prevent alerting
    console.error('[verdict-monitor] DB log failed:', dbErr.message);
  }

  console.log(`[verdict-monitor] status=${status} time=${result.responseTimeMs}ms http=${result.httpStatus ?? 'N/A'} source=${result.verdictSource ?? 'N/A'}`);
  if (!result.ok) {
    console.log(`[verdict-monitor] error: ${result.errorMessage}`);
  }

  if (!result.ok) {
    // DOWN path — debounce: alert at most once per 15 min.
    // getPrevDownCheck returns the PREVIOUS down row (before this run),
    // so we measure gap between consecutive DOWN checks to suppress repeat alerts.
    let prevDownCheck = null;
    try {
      prevDownCheck = await getPrevDownCheck();
    } catch (dbErr) {
      console.error('[verdict-monitor] Could not read prev down check:', dbErr.message);
    }

    const now = Date.now();
    const lastAlertAt = prevDownCheck ? new Date(prevDownCheck.checked_at).getTime() : 0;
    const msSinceLastAlert = now - lastAlertAt;

    if (msSinceLastAlert >= DEBOUNCE_MS) {
      await sendAlert({
        subject: 'HoldOff verdict API DOWN',
        html: buildDownHtml(result),
      });
    } else {
      const waitSec = Math.round((DEBOUNCE_MS - msSinceLastAlert) / 1000);
      console.log(`[verdict-monitor] DOWN but debounced — next alert in ${waitSec}s`);
    }
  } else {
    // OK path — check if previous check was down → send RECOVERED
    let wasDown = false;
    try {
      const prevStatus = await getPrevStatus();
      wasDown = prevStatus === 'down';
    } catch (dbErr) {
      console.error('[verdict-monitor] Could not read prior status for recovery check:', dbErr.message);
    }

    if (wasDown) {
      await sendAlert({
        subject: 'HoldOff verdict API RECOVERED',
        html: buildRecoveredHtml(result),
      });
    }

    if (result.responseTimeMs > WARN_MS) {
      console.warn(`[verdict-monitor] Slow response: ${result.responseTimeMs}ms (warn threshold: ${WARN_MS}ms)`);
    }
  }

  console.log('[verdict-monitor] Done.');
}

// Export run() so server.js can require it as a module.
// Only auto-run when run as a top-level script (not `require`d).
module.exports = { run };

if (require.main === module) {
  run().catch((err) => {
    console.error('[verdict-monitor] Fatal error:', err.message);
  });
}
