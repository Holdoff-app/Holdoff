/**
 * Questionnaire Route for HoldOff
 * Handles comprehensive conditions & wellness assessment
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db/messages');
const { requireAuth } = require('../lib/auth');
const { pool } = require('../db/index');

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
});

/**
 * GET /api/questionnaire
 * Serve the questionnaire HTML
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'conditions-questionnaire.html'));
});

/**
 * POST /api/questionnaire/submit
 * Store user conditions and attachment style
 * 
 * Body: { userId, conditions: [], attachment_style }
 */
router.post('/submit', submitLimiter, requireAuth, async (req, res) => {
  try {
    // Accept userId from body for legacy callers; prefer the authenticated user id.
    const userId = req.user?.id || req.body.userId;
    const { conditions = [], attachment_style, pattern_tracking_enabled, spiral_tracking_enabled } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Validate conditions array
    const validConditions = ['rsd', 'anxiety', 'depression', 'addiction', 'trauma', 'autism', 'adhd'];
    const sanitizedConditions = conditions.filter(c => validConditions.includes(c));

    // Replace existing conditions atomically (delete-all then re-insert),
    // so deselected conditions are actually removed on save.
    await db.setUserConditions(userId, sanitizedConditions);

    await pool.query(
      `INSERT INTO user_preferences (
         user_id, pattern_tracking_enabled, spiral_tracking_enabled, onboarded, created_at, updated_at
       )
       VALUES ($1, $2, $3, true, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET pattern_tracking_enabled = EXCLUDED.pattern_tracking_enabled,
           spiral_tracking_enabled = EXCLUDED.spiral_tracking_enabled,
           updated_at = NOW()`,
      [
        userId,
        pattern_tracking_enabled !== false,
        spiral_tracking_enabled !== false,
      ]
    );

    // Store attachment style if provided
    if (attachment_style) {
      const validAttachmentStyles = ['secure', 'anxious', 'avoidant', 'fearful-avoidant'];
      if (validAttachmentStyles.includes(attachment_style)) {
        // Update user profile with attachment style (future: add to user table)
        console.log(`Attachment style for user ${userId}: ${attachment_style}`);
      }
    }

    res.json({
      success: true,
      message: 'Conditions saved successfully',
      conditions: sanitizedConditions,
      attachment_style,
      pattern_tracking_enabled: pattern_tracking_enabled !== false,
      spiral_tracking_enabled: spiral_tracking_enabled !== false,
    });
  } catch (err) {
    console.error('Error submitting questionnaire:', err);
    res.status(500).json({ error: 'Failed to save conditions' });
  }
});

/**
 * GET /api/questionnaire/user-conditions/:userId
 * Get user's selected conditions
 */
router.get('/user-conditions/:userId', readLimiter, requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const conditions = await db.getUserConditions(userId);
    const prefs = await pool.query(
      `SELECT pattern_tracking_enabled, spiral_tracking_enabled
       FROM user_preferences
       WHERE user_id = $1`,
      [userId]
    );
    const settings = prefs.rows[0] || {};
    
    res.json({
      userId,
      conditions,
      count: conditions.length,
      pattern_tracking_enabled: settings.pattern_tracking_enabled !== false,
      spiral_tracking_enabled: settings.spiral_tracking_enabled !== false,
    });
  } catch (err) {
    console.error('Error fetching user conditions:', err);
    res.status(500).json({ error: 'Failed to fetch conditions' });
  }
});

module.exports = router;