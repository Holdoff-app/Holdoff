/**
 * Community routes — shared feed + weekly poems.
 * GET  /api/community/feed        — list recent posts (public, anon)
 * POST /api/community/post        — create post (auth optional, anon display)
 * POST /api/community/react       — react to a post
 * GET  /api/community/poems       — list this week's poems
 * POST /api/community/poems       — submit a poem (auth optional)
 * POST /api/community/poems/like  — like a poem
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../db/index');
const { getCookieTokens, verifyToken } = require('../lib/auth');

function getUserId(req) {
  try {
    const tokens = getCookieTokens(req);
    const p = tokens.accessPayload || tokens.refreshPayload;
    return p?.id || null;
  } catch { return null; }
}

function anonName() {
  const adjectives = ['Calm','Grounded','Quiet','Steady','Brave','Soft','Still','Clear','Warm','Open'];
  const nouns = ['Heart','Mind','Soul','Wave','Pause','Moment','Breath','Voice','Space','Light'];
  return adjectives[Math.floor(Math.random()*adjectives.length)] + nouns[Math.floor(Math.random()*nouns.length)];
}

// GET /api/community/feed
router.get('/feed', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit)||30, 100);
    const { rows } = await pool.query(
      `SELECT id, display_name, content, mood_level, mood_label, reactions, created_at
       FROM community_posts
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ posts: rows });
  } catch(e) {
    console.error('[community] feed error:', e.message);
    res.json({ posts: [] });
  }
});

// POST /api/community/post
router.post('/post', async (req, res) => {
  try {
    const { content, mood_level, mood_label } = req.body || {};
    if (!content || content.trim().length < 3) return res.status(400).json({ error: 'Content too short' });
    const userId = getUserId(req);
    const displayName = anonName();
    const { rows } = await pool.query(
      `INSERT INTO community_posts (user_id, display_name, content, mood_level, mood_label)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, display_name, content, mood_level, mood_label, reactions, created_at`,
      [userId, displayName, content.trim().slice(0,280), mood_level||null, mood_label||null]
    );
    res.json(rows[0]);
  } catch(e) {
    console.error('[community] post error:', e.message);
    res.status(500).json({ error: 'Failed to post' });
  }
});

// POST /api/community/react
router.post('/react', async (req, res) => {
  try {
    const { post_id } = req.body || {};
    if (!post_id) return res.status(400).json({ error: 'post_id required' });
    await pool.query(
      `UPDATE community_posts SET reactions = reactions + 1 WHERE id = $1`,
      [post_id]
    );
    res.json({ ok: true });
  } catch(e) {
    res.json({ ok: false });
  }
});

// GET /api/community/poems
router.get('/poems', async (req, res) => {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0,0,0,0);
    const { rows } = await pool.query(
      `SELECT id, display_name, title, content, likes, won_week, created_at
       FROM community_poems
       WHERE created_at >= $1
       ORDER BY likes DESC, created_at ASC
       LIMIT 50`,
      [weekStart.toISOString()]
    );
    res.json({ poems: rows });
  } catch(e) {
    console.error('[community] poems error:', e.message);
    res.json({ poems: [] });
  }
});

// POST /api/community/poems
router.post('/poems', async (req, res) => {
  try {
    const { title, content } = req.body || {};
    if (!content || content.trim().length < 10) return res.status(400).json({ error: 'Too short' });
    const userId = getUserId(req);
    const displayName = anonName();
    const weekOf = new Date();
    weekOf.setDate(weekOf.getDate() - weekOf.getDay());
    const { rows } = await pool.query(
      `INSERT INTO community_poems (user_id, display_name, title, content, week_of)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, display_name, title, content, likes, created_at`,
      [userId, displayName, (title||'Untitled').trim().slice(0,100), content.trim().slice(0,400), weekOf.toISOString().slice(0,10)]
    );
    res.json(rows[0]);
  } catch(e) {
    console.error('[community] poem submit error:', e.message);
    res.status(500).json({ error: 'Failed to submit poem' });
  }
});

// POST /api/community/poems/like
router.post('/poems/like', async (req, res) => {
  try {
    const { poem_id } = req.body || {};
    if (!poem_id) return res.status(400).json({ error: 'poem_id required' });
    await pool.query(`UPDATE community_poems SET likes = likes + 1 WHERE id = $1`, [poem_id]);
    res.json({ ok: true });
  } catch(e) {
    res.json({ ok: false });
  }
});

module.exports = router;
