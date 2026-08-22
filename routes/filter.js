/**
 * Filter route — AI message interpret for HoldOff.
 * Owns: POST /api/filter/interpret, POST /api/filter/intercept-event, GET /api/filter/ping.
 * Does NOT own: verdict (see /api/verdict).
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { logVerdictCall } = require('../db/healthchecks');
const { logExitIntentEvent } = require('../db/exit-intent');
const { findUserById } = require('../db/users');
const {
  callWithFallback,
  HANDLER_HARD_TIMEOUT_MS,
  SYSTEM_PROMPT: INTERPRET_SYSTEM_PROMPT,
  parseCookies,
  extractProInfo,
  getVerdictCount,
  STATIC_HOLD,
  normalizeRegulatedBoundaryVerdict,
  regulatedPauseBoundaryResponse,
} = require('../lib/verdict-ai');
const { isProEmail } = require('../db/subscriptions');
const { verifyToken, getCookieTokens } = require('../lib/auth');
const { getAttachmentProfile } = require('../db/quiz');
const { recordVerdict } = require('../db/verdict-history');
const { buildAnalyzeFallback, buildInterpretFallback } = require('../services/resilient-ai');

const FREE_VERDICT_LIMIT = 3;

// Diagnostic ping — no body parsing, no AI call, instant response.
router.get('/ping', (_req, res) => {
  console.log('[filter] ping OK');
  res.json({ ok: true, ts: Date.now() });
});

router.post('/interpret', async (req, res) => {
  const reqId = crypto.randomBytes(4).toString('hex');
  const t0 = Date.now();
  const log = (phase, extra = '') =>
    console.log(`[filter] reqId=${reqId} phase=${phase} elapsed=${Date.now() - t0}ms${extra ? ' ' + extra : ''}`);

  log('received');

  try {

  const { message, style } = req.body || {};

  if (!message || !message.trim()) {
    log('rejected', 'reason=missing_message');
    return res.status(400).json({ error: 'message is required' });
  }

  log('input_parsed', `msgLen=${message.length}`);

  // --- Entitlement check ---
  const cookies = parseCookies(req.headers.cookie);
  const authHeader = req.headers.authorization;
  let isLoggedIn = false;
  let membership = null;

  let jwtPayload = null;
  if (authHeader?.startsWith('Bearer ')) {
    jwtPayload = verifyToken(authHeader.slice(7));
  }
  if (!jwtPayload) {
    const tokens = getCookieTokens(req);
    jwtPayload = tokens.accessPayload || tokens.refreshPayload;
  }
  if (jwtPayload?.id) {
    isLoggedIn = true;
  }

  if (!isLoggedIn) {
    const proInfo = extractProInfo(cookies);
    if (proInfo?.email) {
      const isActive = await isProEmail(proInfo.email).catch(() => false);
      if (isActive) {
        membership = proInfo.membership || 'online';
      }
    }
  }

  if (!isLoggedIn && !membership) {
    const count = getVerdictCount(cookies);
    const loggedInUser = jwtPayload?.id;
    const freeLimit = loggedInUser ? 5 : FREE_VERDICT_LIMIT;
    if (count >= freeLimit) {
      log('paywall_hit', `count=${count} limit=${freeLimit} loggedIn=${!!loggedInUser}`);
      return res.status(402).json({
        error: 'free_limit_reached',
        verdicts_used: count,
        limit: freeLimit,
        membership_tier: null,
      });
    }
  }

  const userStyle = style && style.trim() ? style.trim() : 'Not sure — figure it out';
  const userContent = `Partner's message:\n${message}\n\nSuspected style: ${userStyle}`;

  log('model_call_started');

  let raw, source;
  try {
    const result = await Promise.race([
      callWithFallback(INTERPRET_SYSTEM_PROMPT, userContent, log),
      new Promise((_, reject) => setTimeout(() => {
        const err = new Error('Handler hard timeout');
        err._hardTimeout = true;
        reject(err);
      }, HANDLER_HARD_TIMEOUT_MS)),
    ]);
    raw = result.raw;
    source = result.source;
  } catch (err) {
    log('hard_timeout_or_error', `msg=${err.message} hardTimeout=${!!err._hardTimeout}`);
    raw = null;
    source = 'fallback';
  }

  const latencyMs = Date.now() - t0;

  if (source === 'fallback') {
    log('all_paths_failed', `latency=${latencyMs}ms`);
    logVerdictCall({ verdictSource: 'fallback', verdict: 'INTERPRET_FALLBACK', latencyMs, errorMessage: 'All AI paths failed' }).catch(() => {});
    return res.status(200).json(buildInterpretFallback(message));
  }

  log('model_call_returned', `source=${source}`);

  let parsed;
  try {
    let cleanRaw = raw.trim();
    if (cleanRaw.startsWith('```')) {
      cleanRaw = cleanRaw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }
    parsed = JSON.parse(cleanRaw);
  } catch (_) {
    console.error(`[filter] reqId=${reqId} JSON parse failed, rawLen=${raw.length}, first200=${JSON.stringify(raw.slice(0, 200))}`);
    logVerdictCall({ verdictSource: source, verdict: null, latencyMs, errorMessage: 'JSON parse failed' }).catch(() => {});
    return res.status(500).json({ error: 'Interpretation failed. Try again.' });
  }

  const required = ['detected_style', 'what_it_means', 'how_you_misread_it', 'what_they_need'];
  for (const field of required) {
    if (!(field in parsed) || parsed[field] === undefined) {
      console.error(`[filter] reqId=${reqId} Missing field: ${field}`);
      logVerdictCall({ verdictSource: source, verdict: null, latencyMs, errorMessage: `Missing field: ${field}` }).catch(() => {});
      return res.status(500).json({ error: 'Interpretation incomplete. Try again.' });
    }
  }

  const validStyles = ['Anxious', 'Avoidant', 'Dismissive-Avoidant', 'Fearful-Avoidant'];
  if (!validStyles.includes(parsed.detected_style)) {
    parsed.detected_style = 'Avoidant';
  }

  logVerdictCall({ verdictSource: source, verdict: 'INTERPRET', latencyMs }).catch(() => {});

  if (!isLoggedIn && !membership) {
    const newCount = getVerdictCount(cookies) + 1;
    res.cookie('hf_vc', String(newCount), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    parsed.verdicts_used = newCount;
    const freeLimit = isLoggedIn ? 5 : FREE_VERDICT_LIMIT;
    parsed.verdicts_remaining = Math.max(0, freeLimit - newCount);
  } else {
    parsed.unlimited = true;
    parsed.membership = membership;
  }

  parsed.source = source;
  log('response_sent', `source=${source}`);
  return res.json(parsed);

  } catch (fatalErr) {
    const latencyMs = Date.now() - t0;
    console.error(`[filter] reqId=${reqId} FATAL UNCAUGHT: ${fatalErr.message}`);
    logVerdictCall({ verdictSource: 'fallback', verdict: 'INTERPRET_FALLBACK', latencyMs, errorMessage: `Fatal: ${fatalErr.message}` }).catch(() => {});
    if (!res.headersSent) {
      return res.status(200).json({
        detected_style: 'Avoidant',
        what_it_means: "Something went wrong on our end. The message can wait a minute.",
        how_you_misread_it: "Technical errors happen. This one is on us, not on you.",
        what_they_need: "Take a breath. Try again in a moment.",
        source: 'fallback',
      });
    }
  }
});

// POST /api/filter/analyze — used by the /filter form
router.post('/analyze', async (req, res) => {
  const reqId = crypto.randomBytes(4).toString('hex');
  const t0 = Date.now();
  const log = (phase, extra = '') =>
    console.log(`[filter:analyze] reqId=${reqId} phase=${phase} elapsed=${Date.now() - t0}ms${extra ? ' ' + extra : ''}`);

  log('received');

  try {
    const { message, context } = req.body || {};
    if (!message || !message.trim()) {
      log('rejected', 'reason=missing_message');
      return res.status(400).json({ error: 'message is required' });
    }

    const cookies = parseCookies(req.headers.cookie);
    const authHeader = req.headers.authorization;
    let isLoggedIn = false;
    let membership = null;

    let jwtPayload = null;
    if (authHeader?.startsWith('Bearer ')) {
      jwtPayload = verifyToken(authHeader.slice(7));
    }
    if (!jwtPayload) {
      const tokens = getCookieTokens(req);
      jwtPayload = tokens.accessPayload || tokens.refreshPayload;
    }
    if (jwtPayload?.id) isLoggedIn = true;

    if (!isLoggedIn) {
      const proInfo = extractProInfo(cookies);
      if (proInfo?.email) {
        const isActive = await isProEmail(proInfo.email).catch(() => false);
        if (isActive) membership = proInfo.membership || 'online';
      }
    }

    if (!isLoggedIn && !membership) {
      const count = getVerdictCount(cookies);
      const freeLimit = isLoggedIn ? 5 : FREE_VERDICT_LIMIT;
      if (count >= freeLimit) {
        return res.status(402).json({
          error: 'free_limit_reached', verdicts_used: count, limit: freeLimit,
        });
      }
    }

    // Look up user's attachment style for personalized AI verdict
    const attachmentProfile = jwtPayload?.id ? await getAttachmentProfile(jwtPayload.id).catch(() => null) : null;

    // Deterministic quality guard: healthy pause/boundary language should be SEND even if AI keys are down.
    const regulatedBoundary = regulatedPauseBoundaryResponse(message);
    if (regulatedBoundary) {
      const latencyMs = Date.now() - t0;
      logVerdictCall({ verdictSource: 'rules', verdict: 'SEND', latencyMs }).catch(() => {});
      log('regulated_boundary_send');
      return res.json(regulatedBoundary);
    }

    const combinedPrompt = context && context.trim()
      ? `Context: ${context}\n\nMessage to analyze:\n${message}`
      : `Message to analyze:\n${message}`;

    log('model_call_started');
    let raw, source;
    try {
      const result = await Promise.race([
        callWithFallback(require('../lib/verdict-ai').SYSTEM_PROMPT, combinedPrompt, log, attachmentProfile),
        new Promise((_, reject) => setTimeout(() => {
          const err = new Error('Handler hard timeout');
          err._hardTimeout = true;
          reject(err);
        }, HANDLER_HARD_TIMEOUT_MS)),
      ]);
      raw = result.raw;
      source = result.source || (raw ? 'ai' : 'fallback');
    } catch (err) {
      log('hard_timeout_or_error', `msg=${err.message}`);
      raw = null;
      source = 'fallback';
    }

    const latencyMs = Date.now() - t0;

    if (source === 'fallback') {
      log('fallback_response', `latency=${latencyMs}ms`);
      logVerdictCall({ verdictSource: 'fallback', verdict: 'HOLD', latencyMs, errorMessage: 'All AI paths failed' }).catch(() => {});
      return res.json({ ...buildAnalyzeFallback(message), fallback_default: STATIC_HOLD.pattern });
    }

    let parsed;
    try {
      let cleanRaw = raw.trim();
      if (cleanRaw.startsWith('```')) {
        cleanRaw = cleanRaw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      }
      parsed = JSON.parse(cleanRaw);
    } catch (_) {
      logVerdictCall({ verdictSource: source, verdict: null, latencyMs, errorMessage: 'JSON parse failed' }).catch(() => {});
      return res.status(500).json({ error: 'Analysis failed. Try again.' });
    }

    const required = ['verdict', 'pattern', 'whats_happening', 'grounded_voice', 'rewrite'];
    for (const field of required) {
      if (!(field in parsed) || parsed[field] === undefined) {
        logVerdictCall({ verdictSource: source, verdict: null, latencyMs, errorMessage: `Missing field: ${field}` }).catch(() => {});
        return res.status(500).json({ error: 'Analysis incomplete. Try again.' });
      }
    }

    if (!['SEND', 'HOLD', 'REWRITE'].includes(parsed.verdict)) {
      parsed.verdict = 'HOLD';
    }

    parsed = normalizeRegulatedBoundaryVerdict(parsed, message);

    logVerdictCall({ verdictSource: source, verdict: parsed.verdict, latencyMs }).catch(() => {});

    if (!isLoggedIn && !membership) {
      const newCount = getVerdictCount(cookies) + 1;
      res.cookie('hf_vc', String(newCount), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });
      parsed.verdicts_used = newCount;
      parsed.verdicts_remaining = Math.max(0, FREE_VERDICT_LIMIT - newCount);
    } else {
      parsed.unlimited = true;
      parsed.membership = membership;
    }

    parsed.verdict_source = source;
    parsed.confidence = parsed.confidence || 0.9;
    log('response_sent', `verdict=${parsed.verdict} source=${source}`);
    return res.json(parsed);

  } catch (fatalErr) {
    const latencyMs = Date.now() - t0;
    console.error(`[filter:analyze] reqId=${reqId} FATAL: ${fatalErr.message}`);
    logVerdictCall({ verdictSource: 'fallback', verdict: 'HOLD', latencyMs, errorMessage: `Fatal: ${fatalErr.message}` }).catch(() => {});
    if (!res.headersSent) {
      return res.json({ ...buildAnalyzeFallback(req.body?.message), fallback_default: STATIC_HOLD.pattern });
    }
  }
});

const INTERCEPT_RATE_LIMIT = 10;
const interceptCounts = new Map();

setInterval(() => interceptCounts.clear(), 24 * 60 * 60 * 1000);

router.post('/intercept-event', async (req, res) => {
  const { event_type, device_id } = req.body || {};

  if (!event_type || !device_id) {
    return res.status(400).json({ error: 'event_type and device_id are required' });
  }

  const allowed = ['hold_intercepted'];
  if (!allowed.includes(event_type)) {
    return res.status(400).json({ error: 'invalid event_type' });
  }

  const count = interceptCounts.get(device_id) || 0;
  if (count >= INTERCEPT_RATE_LIMIT) {
    return res.status(429).json({ error: 'rate_limit_exceeded' });
  }
  interceptCounts.set(device_id, count + 1);

  try {
    await logExitIntentEvent({ event_type, email: null, device_id });
    res.json({ ok: true });
  } catch (err) {
    console.error(`[filter] intercept-event error: ${err.message}`);
    res.status(500).json({ error: 'failed to log event' });
  }
});

module.exports = router;
