/**
 * Attachment style quiz routes.
 * GET  /         — renders quiz.ejs (optional auth)
 * POST /api/quiz/save-result  (requireAuth) — save final result
 * GET  /api/quiz/result       (requireAuth) — get saved result
 * POST /api/quiz/progress     (optionalAuth) — save mid-quiz progress
 */
const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../lib/auth');
const {
  saveQuizResult,
  getQuizResult,
  updateUsersAttachmentStyle,
  saveQuizAnswer,
  getQuizAnswers,
  submitQuiz,
  getAttachmentProfile,
} = require('../db/quiz');
const { clearAttachmentProfile } = require('../db/users');
const { enqueueNurtureEmail } = require('../db/nurture-queue');

/**
 * Render the quiz page (start, quiz, or results screen handled client-side).
 * Optional auth — pass user to template for personalized CTA.
 */
router.get('/', optionalAuth, (req, res) => {
  res.render('quiz', { user: req.user || null });
});

/**
 * Save the final quiz result to the database.
 * Requires authentication.
 */
router.post('/save-result', requireAuth, async (req, res) => {
  try {
    const { primaryStyle, secondaryStyle, scores, answerData } = req.body;

    if (!primaryStyle || !scores) {
      return res.status(400).json({ error: 'primaryStyle and scores are required.' });
    }

    const validStyles = ['anxious_preoccupied', 'dismissive_avoidant', 'fearful_avoidant', 'secure'];
    if (!validStyles.includes(primaryStyle)) {
      return res.status(400).json({ error: 'Invalid primary style.' });
    }
    if (secondaryStyle && !validStyles.includes(secondaryStyle)) {
      return res.status(400).json({ error: 'Invalid secondary style.' });
    }

    await saveQuizResult({ userId: req.user.id, primaryStyle, secondaryStyle, scores, answerData });
    await updateUsersAttachmentStyle(req.user.id, primaryStyle);

    // Enqueue nurture email step 1 for quiz completers (high-intent trigger).
    // Idempotent INSERT — won't duplicate if they signed up via another source.
    enqueueNurtureEmail(req.user.email, 1, new Date()).catch(err =>
      console.error('[quiz] nurture enqueue error:', err.message)
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[quiz] save-result error:', err?.message);
    res.status(500).json({ error: 'Failed to save result.' });
  }
});

/**
 * Get the saved quiz result for the logged-in user.
 */
router.get('/result', requireAuth, async (req, res) => {
  try {
    const result = await getQuizResult(req.user.id);
    if (!result) {
      return res.json({ result: null });
    }
    res.json({
      result: {
        primaryStyle: result.primary_style,
        secondaryStyle: result.secondary_style,
        scores: result.scores,
        completedAt: result.completed_at,
      },
    });
  } catch (err) {
    console.error('[quiz] result error:', err?.message);
    res.status(500).json({ error: 'Failed to fetch result.' });
  }
});

/**
 * Save a single quiz answer. Called after each question.
 * Returns 200 with current cumulative scores.
 */
router.post('/answer', requireAuth, async (req, res) => {
  try {
    const { question_number, selected_option } = req.body || {};

    if (!question_number || !selected_option) {
      return res.status(400).json({ error: 'question_number and selected_option are required.' });
    }
    if (question_number < 1 || question_number > 5) {
      return res.status(400).json({ error: 'question_number must be between 1 and 5.' });
    }
    if (!['A', 'B', 'C', 'D'].includes(selected_option)) {
      return res.status(400).json({ error: 'selected_option must be A, B, C, or D.' });
    }

    const scores = await saveQuizAnswer({
      userId: req.user.id,
      questionNumber: question_number,
      selectedOption: selected_option,
    });

    res.json({ success: true, scores });
  } catch (err) {
    console.error('[quiz] answer error:', err?.message);
    res.status(500).json({ error: 'Failed to save answer.' });
  }
});

/**
 * Finalize the quiz: compute attachment profile, write to user_attachment_profiles.
 * Returns 200 with dominant_style, secondary_style, and raw profile scores.
 */
router.post('/submit', requireAuth, async (req, res) => {
  try {
    const { answers } = req.body || {};

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'answers array is required.' });
    }
    if (answers.length !== 5) {
      return res.status(400).json({ error: 'All 5 questions must be answered.' });
    }
    for (const a of answers) {
      if (!a.question_number || !a.selected_option) {
        return res.status(400).json({ error: 'Each answer must have question_number and selected_option.' });
      }
      if (a.question_number < 1 || a.question_number > 5) {
        return res.status(400).json({ error: 'question_number must be between 1 and 5.' });
      }
      if (!['A', 'B', 'C', 'D'].includes(a.selected_option)) {
        return res.status(400).json({ error: 'selected_option must be A, B, C, or D.' });
      }
    }

    const { dominant, secondary, scores } = await submitQuiz({
      userId: req.user.id,
      answers,
    });

    res.json({
      success: true,
      dominant_style: dominant,
      secondary_style: secondary,
      profile: {
        anxious_score: scores.ANX,
        avoidant_score: scores.AVO,
        fearful_score: scores.FA,
        secure_score: scores.SEC,
      },
    });
  } catch (err) {
    console.error('[quiz] submit error:', err?.message);
    res.status(500).json({ error: 'Failed to submit quiz.' });
  }
});

/**
 * Return the current user's attachment profile.
 */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await getAttachmentProfile(req.user.id);

    if (!profile) {
      return res.json({
        quiz_completed: false,
        dominant_style: null,
        secondary_style: null,
        anxious_score: 0,
        avoidant_score: 0,
        fearful_score: 0,
        secure_score: 0,
      });
    }

    res.json({
      quiz_completed: profile.quiz_completed_at !== null,
      dominant_style: profile.dominant_style,
      secondary_style: profile.secondary_style,
      anxious_score: profile.anxious_score,
      avoidant_score: profile.avoidant_score,
      fearful_score: profile.fearful_score,
      secure_score: profile.secure_score,
    });
  } catch (err) {
    console.error('[quiz] profile error:', err?.message);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

/**
 * Reset the quiz (for retake). Clears profile and responses.
 */
router.delete('/reset', requireAuth, async (req, res) => {
  try {
    await clearAttachmentProfile(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[quiz] reset error:', err?.message);
    res.status(500).json({ error: 'Failed to reset quiz.' });
  }
});

/**
 * Save mid-quiz progress to localStorage (client-side) and optionally to DB.
 * For logged-in users, also persists to the DB for later resume.
 */
router.post('/progress', requireAuth, async (req, res) => {
  try {
    const { answerData } = req.body;
    // Persist mid-quiz state — save without marking completed_at
    // (saveQuizResult with completed_at for in-progress saves is fine;
    // for resume we just store answer_data)
    if (answerData) {
      await saveQuizResult({
        userId: req.user.id,
        primaryStyle: '__in_progress__',
        secondaryStyle: null,
        scores: { placeholder: true },
        answerData,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[quiz] progress error:', err?.message);
    res.status(500).json({ error: 'Failed to save progress.' });
  }
});

module.exports = router;
