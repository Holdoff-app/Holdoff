/**
 * Autonomous AI Agent route — HoldOff.
 *
 * POST /api/agent/run
 *   Body: { task: string, context?: string[] }
 *   Auth: optional (some tools require login)
 *
 * Runs the ReAct agent loop and returns:
 *   { answer, steps, stepsUsed }
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { verifyToken, getCookieTokens } = require('../lib/auth');
const { runAgent } = require('../lib/agent');

// Rate-limit: 20 runs per user per minute (agent calls are expensive)
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many agent requests. Please slow down.', code: 'RATE_LIMITED' },
  keyGenerator: (req) => {
    // Key by user ID if authenticated, otherwise by IP
    const tokens = getCookieTokens(req);
    const payload = tokens.accessPayload;
    return payload?.id ? `user:${payload.id}` : req.ip;
  },
});

/**
 * Resolve authenticated user ID from request (JWT cookie or Authorization header).
 * Returns null for unauthenticated requests.
 */
function resolveUserId(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyToken(authHeader.slice(7));
    if (payload?.id) return payload.id;
  }
  const tokens = getCookieTokens(req);
  const payload = tokens.accessPayload || tokens.refreshPayload;
  return payload?.id ?? null;
}

/**
 * POST /api/agent/run
 *
 * Runs the autonomous AI agent on the given task.
 *
 * Request body:
 *   task    {string}   — what you want the agent to do / answer
 *   context {string[]} — optional list of extra context strings
 *
 * Response:
 *   answer    {string}   — the agent's final answer
 *   steps     {object[]} — full reasoning chain (thought/action/observation for each step)
 *   stepsUsed {number}   — how many reasoning steps were taken
 */
router.post('/run', agentLimiter, async (req, res) => {
  const { task, context } = req.body || {};

  if (!task || typeof task !== 'string' || !task.trim()) {
    return res.status(400).json({ error: 'task is required' });
  }

  if (task.length > 2000) {
    return res.status(400).json({ error: 'task must be 2000 characters or fewer' });
  }

  const contextLines = Array.isArray(context)
    ? context.filter(c => typeof c === 'string').slice(0, 10)
    : [];

  const userId = resolveUserId(req);

  try {
    const result = await runAgent(task.trim(), userId, contextLines);
    return res.json(result);
  } catch (err) {
    console.error('[agent] runAgent error:', err.message);
    return res.status(500).json({ error: 'Agent execution failed. Please try again.' });
  }
});

module.exports = router;
