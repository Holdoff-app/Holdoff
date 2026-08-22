/**
 * Journal route — Pattern Journal for HoldOff.
 * Owns: GET /journal (page), POST /api/journal/entries (create), GET /api/journal/entries (list),
 *       PATCH /api/journal/entries/:id, DELETE /api/journal/entries/:id, GET /api/journal/insights.
 * Does NOT own: filter.js (verdict), auth.js (JWT only).
 */
const express = require('express');
const router = express.Router();
const { verifyToken, getCookieTokens } = require('../lib/auth');
const {
  createEntry,
  getEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  getInsights,
  touchStreak,
} = require('../db/journal');
const { getMatchHistory } = require('../db/verdict-history');

/** Require authentication — return 401 JSON if not logged in. */
function requireAuth(req, res, next) {
  const tokens = getCookieTokens(req);
  const payload = tokens.accessPayload || tokens.refreshPayload;
  if (!payload?.id) return res.status(401).json({ error: 'Not authenticated' });
  req.userId = payload.id;
  next();
}

/** GET /journal — journal page (requires auth). */
router.get('/', requireAuth, (req, res) => {
  res.render('journal', { user: { id: req.userId, email: null } });
});

/** POST /api/journal — alias for creating a journal entry (accepts { content, mood } or full entry fields). */
router.post('/', requireAuth, async (req, res) => {
  const body = req.body || {};
  // Map simple { content, mood } shape used by the journal quick-save UI
  const trigger_text = body.trigger_text || body.content;
  const message_text = body.message_text || null;
  const outcome = body.outcome || body.mood || null;
  const { pattern_name, reframe, verdict, source, verdict_log_id } = body;

  if (!trigger_text || String(trigger_text).trim().length < 10) {
    return res.status(400).json({ error: 'Content must be at least 10 characters' });
  }

  try {
    const entry = await createEntry({
      userId: req.userId,
      triggerText: String(trigger_text).trim(),
      messageText: message_text,
      outcome: outcome || null,
      patternName: pattern_name || null,
      reframe: reframe || null,
      verdict: verdict || null,
      source: source || 'manual',
      verdictLogId: verdict_log_id || null,
    });
    await touchStreak(req.userId).catch(() => {});
    res.status(201).json(entry);
  } catch (err) {
    console.error('[journal] createEntry (root) error:', err.message);
    res.status(500).json({ error: 'Failed to save journal entry' });
  }
});

/** POST /api/journal/entries — create a journal entry. */
router.post('/entries', requireAuth, async (req, res) => {
  const { trigger_text, message_text, outcome, pattern_name, reframe, verdict, source, verdict_log_id } = req.body || {};

  if (!trigger_text || trigger_text.trim().length < 10) {
    return res.status(400).json({ error: 'trigger_text must be at least 10 characters' });
  }

  try {
    const entry = await createEntry({
      userId: req.userId,
      triggerText: trigger_text.trim(),
      messageText: message_text?.trim() || null,
      outcome: outcome?.trim() || null,
      patternName: pattern_name?.trim() || null,
      reframe: reframe?.trim() || null,
      verdict: verdict || null,
      source: source || 'manual',
      verdictLogId: verdict_log_id || null,
    });

    // Touch streak for engagement tracking
    await touchStreak(req.userId).catch(() => {});

    res.status(201).json(entry);
  } catch (err) {
    console.error('[journal] createEntry error:', err.message);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

/** GET /api/journal/entries — list entries (newest first). */
router.get('/entries', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const entries = await getEntries(req.userId, limit, offset);
    res.json({ entries, limit, offset });
  } catch (err) {
    console.error('[journal] getEntries error:', err.message);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

/** PATCH /api/journal/entries/:id — update outcome/trigger_text. */
router.patch('/entries/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const entry = await updateEntry(id, req.userId, {
      outcome: req.body.outcome,
      triggerText: req.body.trigger_text,
    });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    console.error('[journal] updateEntry error:', err.message);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

/** DELETE /api/journal/entries/:id */
router.delete('/entries/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const deleted = await deleteEntry(id, req.userId);
    if (!deleted) return res.status(404).json({ error: 'Entry not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[journal] deleteEntry error:', err.message);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

/** GET /api/journal/insights — pattern insights + streak */
router.get('/insights', requireAuth, async (req, res) => {
  try {
    const insights = await getInsights(req.userId);
    res.json(insights);
  } catch (err) {
    console.error('[journal] getInsights error:', err.message);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

/** GET /api/journal/match-history — contacts/analysis targets grouped by pattern name */
router.get('/match-history', requireAuth, async (req, res) => {
  try {
    const history = await getMatchHistory(req.userId);
    res.json(history);
  } catch (err) {
    console.error('[journal] matchHistory error:', err.message);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

module.exports = router;