/**
 * Messaging API routes for HoldOff.
 * Owns: POST /api/sync/threads — receives Android SMS thread sync and writes to DB.
 */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../lib/auth');
const { pool } = require('../db/index');

// Rate limit: 20 syncs per hour per user (Android background sync fires every 15 min)
const syncLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `sync:${req.user?.id || req.ip}`,
  message: { error: 'Sync rate limit exceeded. Try again later.', code: 'RATE_LIMITED' },
  skip: (req) => req.method === 'GET',
});

/**
 * POST /api/sync/threads
 * Body: { threads: [...], lastSyncAt: timestamp }
 *
 * Upserts contacts from thread data, inserts new message_history rows,
 * returns { ok: true, syncedAt: timestamp } for the app to store as lastSyncAt.
 */
router.post('/threads', syncLimit, requireAuth, async (req, res) => {
  const { threads, lastSyncAt = 0 } = req.body || {};
  const userId = req.user.id;

  if (!Array.isArray(threads) || threads.length === 0) {
    return res.status(400).json({ error: 'threads array required' });
  }

  let contactsUpserted = 0;
  let messagesInserted = 0;
  const errors = [];

  for (const thread of threads) {
    const {
      threadId,
      contactName,
      phoneNumber,
      lastMessage,
      lastMessageTime,
      unreadCount = 0,
    } = thread;

    if (!contactName || !lastMessage) continue;

    try {
      // Upsert contact in the contacts table
      const contactResult = await pool.query(
        `INSERT INTO contacts (user_id, display_name, phone_number)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, display_name)
         DO UPDATE SET phone_number = COALESCE($3, contacts.phone_number)
         RETURNING id`,
        [userId, contactName, phoneNumber || null]
      );

      const contactId = contactResult.rows[0]?.id;
      if (!contactId) continue;
      contactsUpserted++;

      // Insert message into message_history (skip if already inserted — deduplicate by ts)
      const msgTime = lastMessageTime ? new Date(lastMessageTime) : new Date();
      const hourOfDay = msgTime.getHours();
      const dayOfWeek = msgTime.getDay(); // 0=Sun..6=Sat

      await pool.query(
        `INSERT INTO message_history
           (user_id, contact_id, direction, pattern_name, verdict, hour_of_day, day_of_week, sent_at)
         VALUES ($1, $2, 'received', NULL, 'pending', $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [userId, contactId, hourOfDay, dayOfWeek, msgTime]
      );
      messagesInserted++;
    } catch (err) {
      errors.push({ threadId, error: err.message });
    }
  }

  console.log(`[messaging/sync] user=${userId} contacts=${contactsUpserted} messages=${messagesInserted} errors=${errors.length}`);

  return res.json({
    ok: true,
    syncedAt: Date.now(),
    contactsUpserted,
    messagesInserted,
    errors: errors.length ? errors : undefined,
  });
});

// Read rate limit: 60/hour
const readLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `threads:${req.user?.id || req.ip}`,
  message: { error: 'Too many requests. Try again later.', code: 'RATE_LIMITED' },
});

/**
 * GET /api/messaging/threads
 * Returns cached thread list for the logged-in user.
 */
router.get('/threads', readLimit, requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.display_name AS contact_name, c.phone_number,
              MAX(mh.sent_at) AS last_message_at,
              COUNT(mh.id)::int AS message_count
       FROM contacts c
       LEFT JOIN message_history mh ON mh.contact_id = c.id AND mh.user_id = c.user_id
       WHERE c.user_id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id, c.display_name, c.phone_number
       ORDER BY last_message_at DESC NULLS LAST
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ threads: rows });
  } catch (err) {
    console.error('[messaging/threads] error:', err.message);
    res.json({ threads: [] });
  }
});

module.exports = router;
