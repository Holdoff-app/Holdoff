/**
 * Interpret handler — aliased to both /api/interpret and /api/filter/interpret.
 * Owns: the POST /interpret handler function.
 * Does NOT own: /api/filter/interpret route registration (see routes/filter.js).
 *
 * Fix #3: interpretHandler now accepts threadHistory (array of {direction, body, timestamp})
 * and appends the last 20 messages as context so Sadie reads the incoming message
 * in the full context of the relationship, not as an isolated event.
 */
const crypto = require('crypto');
const { logVerdictCall } = require('../db/healthchecks');
const {
  callWithFallback,
  HANDLER_HARD_TIMEOUT_MS,
  INTERPRET_SYSTEM_PROMPT,
  buildPersonalizedInterpretPrompt,
  parseCookies,
  extractProInfo,
  getVerdictCount,
} = require('../lib/verdict-ai');
const { isProEmail } = require('../db/subscriptions');
const { verifyToken, getCookieTokens } = require('../lib/auth');
const { getUserPreferences, getUserConditions } = require('../db/preferences');

const FREE_VERDICT_LIMIT = 3;

const NEUTRAL_INTERPRET_FALLBACK = {
  detected_style: 'Unclear',
  confidence: 'low',
  red_flags: [],
  what_it_means: "I can't confidently read their attachment style from this message alone. The grounded read is: there isn't enough evidence yet, and uncertainty does not automatically mean rejection.",
  how_you_misread_it: "When you're anxious, your brain can treat missing context like proof. This is a moment to slow down, not assign a label or build a story around the gap.",
  what_they_need: "A calm, simple response if one is needed — or a pause while you let your nervous system settle before deciding.",
};

/**
 * Build a thread-context block for the AI prompt from the incoming threadHistory array.
 * Each item: { direction: 'sent'|'received', body: string, timestamp: number }
 * Cap at the given limit, oldest first.
 */
function buildThreadContextBlock(threadHistory, cap = 20) {
  if (!Array.isArray(threadHistory) || threadHistory.length === 0) return '';
  const messages = threadHistory.slice(-cap);
  const lines = messages.map(m => {
    const speaker = m.direction === 'sent' ? 'USER' : 'THEM';
    return `[${speaker}] ${m.body}`;
  });
  return '\n\nTHREAD CONTEXT (oldest first, ' + cap + '-message cap):\n' + lines.join('\n');
}

function interpretHandler(req, res, next) {
  const reqId = crypto.randomBytes(4).toString('hex');
  const t0 = Date.now();
  const log = (phase, extra = '') =>
    console.log(`[filter] reqId=${reqId} phase=${phase} elapsed=${Date.now() - t0}ms${extra ? ' ' + extra : ''}`);

  log('received');

  (async () => {
    try {
      const { message, style, threadHistory } = req.body || {};

      if (!message || !message.trim()) {
        log('rejected', 'reason=missing_message');
        return res.status(400).json({ error: 'message is required' });
      }

      log('input_parsed', `msgLen=${message.length} hasThread=${Array.isArray(threadHistory) && threadHistory.length > 0}`);

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

      // Build thread context block (20-message cap) and append to userContent
      const threadContextBlock = buildThreadContextBlock(threadHistory, 20);
      const userContent = `Partner's message:\n${message}\n\nSuspected style: ${userStyle}${threadContextBlock}`;

      log('model_call_started');

      // Fetch user preferences if logged in
      let systemPrompt = INTERPRET_SYSTEM_PROMPT;
      if (jwtPayload?.id) {
        try {
          const prefs = await getUserPreferences(jwtPayload.id);
          if (prefs) {
            systemPrompt = buildPersonalizedInterpretPrompt(prefs);
          }
        } catch (prefErr) {
          // Non-fatal: use default system prompt
          console.error('[interpret] prefs fetch failed:', prefErr.message || prefErr);
        }
      }

      let result;
      try {
        result = await callWithFallback({ systemPrompt, userContent });
      } catch (aiErr) {
        console.error('[interpret] AI call failed:', aiErr.message || aiErr);
        result = NEUTRAL_INTERPRET_FALLBACK;
      }

      log('model_call_done');

      // Log the call for health monitoring
      try {
        await logVerdictCall({ type: 'interpret', success: true });
      } catch (_) { /* non-fatal */ }

      return res.json(result);
    } catch (err) {
      console.error('[interpret] Unexpected error:', err.message || err);
      return res.status(500).json(NEUTRAL_INTERPRET_FALLBACK);
    }
  })();
}

module.exports = { interpretHandler };
