const express = require('express');
const router = express.Router();

// Privacy-safe in-memory Spiral Lock state. Stores counters/timestamps only — never draft/message bodies.
const spiralLocks = new Map();
const spiralAttempts = new Map();

const LOCK_DURATION_MS = 5 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ATTEMPT_THRESHOLD = 5;
const ALLOWED_EVENTS = new Set(['draft_attempt', 'send_attempt', 'manual_trigger']);

function actorId(req) {
  return req.user?.id || req.ip || 'anonymous';
}

function normalizeThreadId(raw) {
  const cleaned = String(raw || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64);
  return cleaned || 'default';
}

function stateKey(req, threadId) {
  return `${actorId(req)}:${normalizeThreadId(threadId)}`;
}

function activeLock(key) {
  const lockInfo = spiralLocks.get(key);
  if (!lockInfo || lockInfo.expiresAt <= Date.now()) {
    spiralLocks.delete(key);
    return null;
  }
  return lockInfo;
}

function lockResponse(key, lockInfo) {
  const remainingMs = Math.max(0, lockInfo.expiresAt - Date.now());
  return {
    locked: true,
    expiresAt: lockInfo.expiresAt,
    remainingMs,
    thread_id: lockInfo.threadId,
    reason: lockInfo.reason,
    event_type: lockInfo.eventType,
    unlock_options: ['timer_wait', 'journal_entry', 'rewrite'],
  };
}


function createLock(key, threadId, eventType, attemptCount) {
  const now = Date.now();
  const lockInfo = {
    expiresAt: now + LOCK_DURATION_MS,
    reason: eventType === 'manual_trigger'
      ? 'Manual Spiral Lock trigger'
      : `${attemptCount} rapid draft/send attempts within 10 minutes`,
    eventType,
    threadId,
    createdAt: now,
  };
  spiralLocks.set(key, lockInfo);
  return lockInfo;
}

// Check Spiral Lock status. Optional ?thread_id=abc keeps locks scoped to a specific conversation/thread.
router.get('/status', (req, res) => {
  const key = stateKey(req, req.query.thread_id);
  const lockInfo = activeLock(key);
  if (!lockInfo) {
    return res.json({ locked: false, thread_id: normalizeThreadId(req.query.thread_id) });
  }
  res.json(lockResponse(key, lockInfo));
});

// Privacy-safe event endpoint called when a user drafts/sends rapidly.
// Body: { event_type: 'draft_attempt'|'send_attempt'|'manual_trigger', thread_id?: string }
router.post('/event', (req, res) => {
  const { event_type, thread_id } = req.body || {};
  const eventType = String(event_type || '').trim();
  const threadId = normalizeThreadId(thread_id);

  if (!ALLOWED_EVENTS.has(eventType)) {
    return res.status(400).json({ error: 'invalid_event_type', allowed: Array.from(ALLOWED_EVENTS) });
  }

  const key = stateKey(req, threadId);
  const existingLock = activeLock(key);
  if (existingLock) {
    return res.json({ ...lockResponse(key, existingLock), attemptsInWindow: ATTEMPT_THRESHOLD });
  }

  const now = Date.now();
  const recent = (spiralAttempts.get(key) || []).filter(ts => now - ts <= ATTEMPT_WINDOW_MS);
  recent.push(now);
  spiralAttempts.set(key, recent);

  const shouldLock = eventType === 'manual_trigger' || recent.length >= ATTEMPT_THRESHOLD;
  if (!shouldLock) {
    return res.json({
      locked: false,
      thread_id: threadId,
      attemptsInWindow: recent.length,
      threshold: ATTEMPT_THRESHOLD,
      windowMs: ATTEMPT_WINDOW_MS,
    });
  }

  const lockInfo = createLock(key, threadId, eventType, recent.length);
  return res.json({ ...lockResponse(key, lockInfo), attemptsInWindow: recent.length });
});

// Backward-compatible trigger endpoint used by older clients.
router.post('/trigger', (req, res) => {
  const threadId = normalizeThreadId(req.body?.thread_id);
  const key = stateKey(req, threadId);
  const existingLock = activeLock(key);
  if (existingLock) {
    return res.json({ ...lockResponse(key, existingLock), attemptsInWindow: ATTEMPT_THRESHOLD });
  }

  const lockInfo = createLock(key, threadId, 'manual_trigger', ATTEMPT_THRESHOLD);
  spiralAttempts.set(key, Array(ATTEMPT_THRESHOLD).fill(Date.now()));
  return res.json({ success: true, ...lockResponse(key, lockInfo), attemptsInWindow: ATTEMPT_THRESHOLD });
});

// Unlock via journal/quiz/timer/rewrite completion. Does not require storing message bodies.
router.post('/unlock', (req, res) => {
  const { answers, method, thread_id } = req.body || {};
  const unlockMethod = String(method || '').trim();
  const key = stateKey(req, thread_id);

  const quizComplete = Array.isArray(answers) && answers.length >= 3;
  const methodAllowed = ['timer_wait', 'journal_entry', 'rewrite'].includes(unlockMethod);
  if (quizComplete || methodAllowed) {
    spiralLocks.delete(key);
    spiralAttempts.delete(key);
    return res.json({ success: true, locked: false, method: unlockMethod || 'quiz', thread_id: normalizeThreadId(thread_id) });
  }

  res.status(400).json({ error: 'unlock_step_required', allowed_methods: ['timer_wait', 'journal_entry', 'rewrite'] });
});

module.exports = router;
