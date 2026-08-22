/**
 * Attachment style quiz queries.
 * Owns: attachment_style_quiz_results table.
 */
const { pool } = require('./index');

/**
 * Save (or update) a user's quiz result.
 * @param {{ userId: number, primaryStyle: string, secondaryStyle: string|null, scores: object, answerData: object[] }} opts
 */
async function saveQuizResult({ userId, primaryStyle, secondaryStyle, scores, answerData }) {
  const { rows } = await pool.query(
    `INSERT INTO attachment_style_quiz_results (user_id, primary_style, secondary_style, scores, answer_data, completed_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET primary_style = EXCLUDED.primary_style,
           secondary_style = EXCLUDED.secondary_style,
           scores = EXCLUDED.scores,
           answer_data = EXCLUDED.answer_data,
           completed_at = NOW()
     RETURNING id, user_id, primary_style, secondary_style, scores, completed_at`,
    [userId, primaryStyle, secondaryStyle || null, scores, answerData ? JSON.stringify(answerData) : null]
  );
  return rows[0] || null;
}

/**
 * Get a user's quiz result. Returns null if not found.
 */
async function getQuizResult(userId) {
  const { rows } = await pool.query(
    `SELECT id, user_id, primary_style, secondary_style, scores, answer_data, completed_at
     FROM attachment_style_quiz_results
     WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Update the attachment_style column on the users table.
 * @param {number} userId
 * @param {string} style - primary attachment style
 */
async function updateUsersAttachmentStyle(userId, style) {
  const { rows } = await pool.query(
    `UPDATE users SET attachment_style = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, attachment_style`,
    [userId, style]
  );
  return rows[0] || null;
}

/**
 * Get mid-quiz progress (answer_data only) for resume functionality.
 * Returns null if no in-progress quiz found.
 */
async function getQuizProgress(userId) {
  const { rows } = await pool.query(
    `SELECT answer_data FROM attachment_style_quiz_results
     WHERE user_id = $1 AND completed_at IS NOT NULL`,
    [userId]
  );
  return rows[0]?.answer_data || null;
}

/**
 * Get a user's primary attachment style from their completed quiz result.
 * Returns null if no completed quiz found.
 */
async function getUserAttachmentStyle(userId) {
  const { rows } = await pool.query(
    `SELECT primary_style FROM attachment_style_quiz_results
     WHERE user_id = $1 AND completed_at IS NOT NULL`,
    [userId]
  );
  return rows[0]?.primary_style || null;
}

/**
 * Server-side scoring table for the 5-question attachment style quiz.
 * Maps { question_number, selected_option } → score increments per style.
 */
const SCORING_TABLE = {
  1: { A: { ANX: 2 }, B: { SEC: 2 }, C: { AVO: 2 }, D: { FA: 2 } },
  2: { A: { ANX: 2 }, B: { AVO: 2 }, C: { SEC: 2 }, D: { FA: 2 } },
  3: { A: { ANX: 2, FA: 1 }, B: { AVO: 2 }, C: { SEC: 2 }, D: { FA: 2 } },
  4: { A: { SEC: 2 }, B: { ANX: 2 }, C: { AVO: 2 }, D: { FA: 2 } },
  5: { A: { SEC: 2 }, B: { AVO: 2, FA: 1 }, C: { ANX: 2 }, D: { FA: 2 } },
};

/**
 * Compute raw scores, dominant, and secondary style from a list of answers.
 * @param {Array<{question_number: number, selected_option: string}>} answers
 * @returns {{ scores: object, dominant: string, secondary: string|null }}
 */
function computeProfile(answers) {
  const scores = { ANX: 0, AVO: 0, FA: 0, SEC: 0 };
  for (const { question_number, selected_option } of answers) {
    const questionScores = SCORING_TABLE[question_number]?.[selected_option];
    if (!questionScores) continue;
    for (const [style, delta] of Object.entries(questionScores)) {
      scores[style] += delta;
    }
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topStyle, topScore] = sorted[0];
  const [secStyle, secScore] = sorted[1];
  const gap = topScore - secScore;
  return {
    scores,
    dominant: topStyle,
    secondary: secScore > 0 && gap >= 2 ? secStyle : null,
  };
}

/**
 * Save or update a single quiz answer during the quiz flow.
 * Returns the current cumulative raw scores for that user.
 */
async function saveQuizAnswer({ userId, questionNumber, selectedOption }) {
  const questionScores = SCORING_TABLE[questionNumber]?.[selectedOption] || {};
  await pool.query(
    `INSERT INTO user_attachment_responses (user_id, question_number, selected_option, scores)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, question_number) DO UPDATE
       SET selected_option = EXCLUDED.selected_option,
           scores = EXCLUDED.scores`,
    [userId, questionNumber, selectedOption, JSON.stringify(questionScores)]
  );

  // Return cumulative scores
  const { rows } = await pool.query(
    `SELECT scores FROM user_attachment_responses WHERE user_id = $1`,
    [userId]
  );
  const scores = { ANX: 0, AVO: 0, FA: 0, SEC: 0 };
  for (const row of rows) {
    const s = row.scores || {};
    for (const [style, delta] of Object.entries(s)) {
      scores[style] += delta;
    }
  }
  return scores;
}

/**
 * Get all saved answers for a user (for submit and profile).
 */
async function getQuizAnswers(userId) {
  const { rows } = await pool.query(
    `SELECT question_number, selected_option
     FROM user_attachment_responses
     WHERE user_id = $1
     ORDER BY question_number`,
    [userId]
  );
  return rows;
}

/**
 * Compute and persist the full attachment profile from quiz answers.
 * Also clears all per-question response rows after persisting.
 */
async function submitQuiz({ userId, answers }) {
  const { scores, dominant, secondary } = computeProfile(answers);

  await pool.query(
    `INSERT INTO user_attachment_profiles
       (user_id, anxious_score, avoidant_score, fearful_score, secure_score, dominant_style, secondary_style, quiz_completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET anxious_score = EXCLUDED.anxious_score,
           avoidant_score = EXCLUDED.avoidant_score,
           fearful_score = EXCLUDED.fearful_score,
           secure_score = EXCLUDED.secure_score,
           dominant_style = EXCLUDED.dominant_style,
           secondary_style = EXCLUDED.secondary_style,
           quiz_completed_at = NOW(),
           updated_at = NOW()`,
    [userId, scores.ANX, scores.AVO, scores.FA, scores.SEC, dominant, secondary || null]
  );

  // Clean up per-question responses now that profile is stored
  await pool.query(`DELETE FROM user_attachment_responses WHERE user_id = $1`, [userId]);

  return { dominant, secondary, scores };
}

/**
 * Get the full attachment profile for a user.
 * Returns null if no completed profile found.
 */
async function getAttachmentProfile(userId) {
  const { rows } = await pool.query(
    `SELECT anxious_score, avoidant_score, fearful_score, secure_score,
            dominant_style, secondary_style, quiz_completed_at
     FROM user_attachment_profiles WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = {
  saveQuizResult,
  getQuizResult,
  updateUsersAttachmentStyle,
  getQuizProgress,
  getUserAttachmentStyle,
  SCORING_TABLE,
  computeProfile,
  saveQuizAnswer,
  getQuizAnswers,
  submitQuiz,
  getAttachmentProfile,
};
