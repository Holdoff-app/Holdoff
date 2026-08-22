/**
 * Daily site health check. Owns: page probes, user flow test, link checks, logging, alerting.
 * Does NOT own: subscription logic, user data, route handling.
 *
 * Run by [[crons]] scheduler weekdays at 9am via render cron.
 * Also available as in-process scheduler in server.js (HOLDOFF_IN_PROCESS_CRONS_ENABLED).
 *
 * Checks:
 *   - GET /  (homepage renders)
 *   - GET /filter  (verdict page renders)
 *   - GET /pricing (pricing page — optional)
 *   - POST /api/filter/analyze  (verdict engine works)
 *   - GET /privacy, /terms, /examples  (key links return 200)
 *
 * Debounce: max 1 alert per 4 hours. Sends daily summary when all checks pass.
 */

'use strict';

const { logSiteCheck, getPrevSiteCheck } = require('../db/healthchecks');

const BASE_URL = process.env.APP_BASE_URL || 'https://shouldiholdoff.live';
const ALERT_TO = process.env.ALERT_EMAIL || 'holdoff@shouldiholdoff.live';
const EMAIL_PROXY_URL = process.env.HOLDOFF_EMAIL_PROXY_URL;
const API_TOKEN = process.env.HOLDOFF_API_TOKEN || process.env.HOLDOFF_API_KEY;

// 4-hour debounce window between failure alerts.
const ALERT_DEBOUNCE_MS = 4 * 60 * 60 * 1000;

// Track last alert timestamp in-memory (survives acrosscron invocations within a process).
let lastAlertAt = 0;

// ── HTTP probe helper ─────────────────────────────────────────────────────────

async function probePage(url, expectedStatus = 200) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let httpStatus = null;
  let errorMessage = null;

  try {
    const resp = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    httpStatus = resp.status;
    const responseTimeMs = Date.now() - start;

    if (resp.status !== expectedStatus) {
      return { ok: false, responseTimeMs, httpStatus, errorMessage: `Expected HTTP ${expectedStatus}, got ${resp.status}` };
    }

    return { ok: true, responseTimeMs, httpStatus };
  } catch (err) {
    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;
    errorMessage = err.name === 'AbortError' ? 'Timeout after 10s' : err.message;
    return { ok: false, responseTimeMs, httpStatus, errorMessage };
  }
}

async function probeAnalyze() {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  let httpStatus = null;
  let errorMessage = null;

  try {
    const resp = await fetch(`${BASE_URL}/api/filter/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        message: 'are you mad at me? I feel like you are ignoring me',
      }),
    });
    clearTimeout(timer);
    httpStatus = resp.status;
    const responseTimeMs = Date.now() - start;

    if (resp.status !== 200) {
      return { ok: false, responseTimeMs, httpStatus, errorMessage: `HTTP ${resp.status}` };
    }

    let parsed;
    try {
      const text = await resp.text();
      parsed = JSON.parse(text);
    } catch (_) {
      return { ok: false, responseTimeMs, httpStatus, errorMessage: 'JSON parse failed' };
    }

    if (!parsed.verdict) {
      return { ok: false, responseTimeMs, httpStatus, errorMessage: 'Missing verdict field in response' };
    }

    return { ok: true, responseTimeMs, httpStatus, verdict: parsed.verdict };
  } catch (err) {
    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;
    errorMessage = err.name === 'AbortError' ? 'Timeout after 15s' : err.message;
    return { ok: false, responseTimeMs, httpStatus, errorMessage };
  }
}

// ── Email alert ───────────────────────────────────────────────────────────────

async function sendAlert({ subject, html }) {
  if (!EMAIL_PROXY_URL || !API_TOKEN) {
    console.warn('[daily-site-health-check] Email proxy not configured — alert not sent');
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
      console.error('[daily-site-health-check] Alert email failed:', resp.status, text);
    } else {
      console.log('[daily-site-health-check] Alert sent:', subject);
    }
  } catch (err) {
    console.error('[daily-site-health-check] Alert send error:', err.message);
  }
}

function buildFailureHtml(checks) {
  const ts = new Date().toISOString();
  const rows = checks
    .filter(c => !c.ok)
    .map(
      c =>
        `<tr style="background:#fde8e8;"><td style="padding:4px 8px;font-weight:bold;">${escapeHtml(c.name)}</td><td style="padding:4px 8px;">${escapeHtml(c.errorMessage || 'Failed')}</td><td style="padding:4px 8px;">${c.responseTimeMs ? c.responseTimeMs + 'ms' : 'N/A'}</td></tr>`
    )
    .join('');
  return `
<div style="font-family:monospace;max-width:600px;margin:0 auto;color:#111;line-height:1.6;">
  <h2 style="color:#c0392b;margin-bottom:0.5rem;">🔴 HoldOff Daily Health Check — FAILURES DETECTED</h2>
  <p style="color:#666;font-size:0.85rem;">${ts}</p>
  <table style="border-collapse:collapse;width:100%;margin-bottom:1rem;">
    <tr style="background:#eee;"><td style="padding:4px 8px;font-weight:bold;">Check</td><td style="padding:4px 8px;font-weight:bold;">Error</td><td style="padding:4px 8px;font-weight:bold;">Time</td></tr>
    ${rows}
  </table>
  <p style="color:#666;font-size:0.85rem;">Base URL: ${BASE_URL}</p>
</div>`.trim();
}

function buildSuccessHtml(checks) {
  const ts = new Date().toISOString();
  const rows = checks
    .map(
      c =>
        `<tr style="background:#e8fde8;"><td style="padding:4px 8px;font-weight:bold;">${escapeHtml(c.name)}</td><td style="padding:4px 8px;color:#27ae60;">✅ PASS</td><td style="padding:4px 8px;">${c.responseTimeMs ? c.responseTimeMs + 'ms' : 'N/A'}</td></tr>`
    )
    .join('');
  return `
<div style="font-family:monospace;max-width:600px;margin:0 auto;color:#111;line-height:1.6;">
  <h2 style="color:#27ae60;margin-bottom:0.5rem;">✅ HoldOff Daily Health Check — ALL CLEAR</h2>
  <p style="color:#666;font-size:0.85rem;">${ts}</p>
  <table style="border-collapse:collapse;width:100%;margin-bottom:1rem;">
    <tr style="background:#eee;"><td style="padding:4px 8px;font-weight:bold;">Check</td><td style="padding:4px 8px;font-weight:bold;">Status</td><td style="padding:4px 8px;font-weight:bold;">Time</td></tr>
    ${rows}
  </table>
  <p style="color:#666;font-size:0.85rem;">Base URL: ${BASE_URL}</p>
</div>`.trim();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('[daily-site-health-check] Starting daily health check');

  // Run all checks in parallel.
  const [homepage, filterPage, pricingPage, analyze, privacy, terms, examples] = await Promise.all([
    probePage(`${BASE_URL}/`),
    probePage(`${BASE_URL}/filter`),
    probePage(`${BASE_URL}/pricing`, 200).catch(() => ({ ok: false, responseTimeMs: 0, httpStatus: null, errorMessage: 'Not available' })),
    probeAnalyze(),
    probePage(`${BASE_URL}/privacy`),
    probePage(`${BASE_URL}/terms`),
    probePage(`${BASE_URL}/examples`),
  ]);

  const checks = [
    { name: 'Homepage', ...homepage },
    { name: 'Filter page', ...filterPage },
    { name: 'Pricing page (optional)', ...pricingPage },
    { name: 'POST /api/filter/analyze', ...analyze },
    { name: 'Privacy page', ...privacy },
    { name: 'Terms page', ...terms },
    { name: 'Examples page', ...examples },
  ];

  const passed = checks.filter(c => c.ok).length;
  const failed = checks.filter(c => !c.ok).length;
  const allPassed = failed === 0;

  console.log(`[daily-site-health-check] Results: ${passed}/${checks.length} passed`);
  for (const c of checks) {
    const icon = c.ok ? '✅' : '❌';
    const extra = c.errorMessage ? ` — ${c.errorMessage}` : c.responseTimeMs ? ` (${c.responseTimeMs}ms)` : '';
    console.log(`[daily-site-health-check]   ${icon} ${c.name}${extra}`);
  }

  // Always log to DB.
  const summary = allPassed
    ? `All ${checks.length} checks passed`
    : `${failed} of ${checks.length} checks failed: ${checks.filter(c => !c.ok).map(c => c.name).join(', ')}`;

  try {
    await logSiteCheck({ passed: allPassed, checks, summary });
  } catch (dbErr) {
    console.error('[daily-site-health-check] DB log failed:', dbErr.message);
  }

  // Alert logic: on failure debounce by 4h; on success, silent (no noise when healthy).
  if (!allPassed) {
    const now = Date.now();
    const msSinceLastAlert = now - lastAlertAt;

    if (msSinceLastAlert >= ALERT_DEBOUNCE_MS) {
      lastAlertAt = now;
      await sendAlert({
        subject: 'HoldOff Daily Health Check — FAILURES DETECTED',
        html: buildFailureHtml(checks),
      });
    } else {
      const waitHr = Math.round((ALERT_DEBOUNCE_MS - msSinceLastAlert) / 3_600_000);
      console.log(`[daily-site-health-check] FAILURES but debounced — next alert in ~${waitHr}h`);
    }
  }

  console.log('[daily-site-health-check] Done.');
}

// Export run() so server.js can require it as a module.
module.exports = { run };

if (require.main === module) {
  run().catch(err => {
    console.error('[daily-site-health-check] Fatal error:', err.message);
  });
}
