/**
 * User preferences storage — from interactive story questionnaire
 * Stores language style, tone, tracking depth, frequency, and conditions from signup story
 */
const { pool } = require('./index');

/**
 * Store user preferences from the interactive story
 * @param {string} userId — UUID of the user
 * @param {object} preferences — preference object
 * @returns {Promise<object>} stored preferences
 */
async function storeUserPreferences(userId, preferences) {
  try {
    // Check if preferences already exist
    const existing = await pool.query(
      'SELECT id FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length > 0) {
      // Update existing
      const result = await pool.query(
        `UPDATE user_preferences 
         SET language_style = $2, 
             tone = $3,
             tracking_depth = $4,
             insight_frequency = $5,
             show_why = $6,
             show_what = $7,
             show_meaning = $8,
             show_action = $9,
             onboarded = $10,
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [
          userId,
          preferences.language_style || 'clinical',
          preferences.tone || 'direct',
          preferences.tracking_depth || 'moderate',
          preferences.insight_frequency || 'daily',
          preferences.show_why !== false,
          preferences.show_what !== false,
          preferences.show_meaning !== false,
          preferences.show_action !== false,
          true
        ]
      );
      return result.rows[0] || null;
    } else {
      // Insert new
      const result = await pool.query(
        `INSERT INTO user_preferences 
         (user_id, language_style, tone, tracking_depth, insight_frequency, 
          show_why, show_what, show_meaning, show_action, onboarded, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING *`,
        [
          userId,
          preferences.language_style || 'clinical',
          preferences.tone || 'direct',
          preferences.tracking_depth || 'moderate',
          preferences.insight_frequency || 'daily',
          preferences.show_why !== false,
          preferences.show_what !== false,
          preferences.show_meaning !== false,
          preferences.show_action !== false,
          true
        ]
      );
      return result.rows[0] || null;
    }
  } catch (err) {
    console.error('[db:preferences] storeUserPreferences error:', err.message);
    throw err;
  }
}

/**
 * Get user preferences
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getUserPreferences(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('[db:preferences] getUserPreferences error:', err.message);
    throw err;
  }
}

/**
 * Add user conditions (multi-select from story)
 * @param {string} userId
 * @param {array} conditions — e.g., ['rsd', 'anxiety', 'attachment']
 * @returns {Promise<array>}
 */
async function addUserConditions(userId, conditions) {
  try {
    const validConditions = [
      'rsd',
      'anxiety',
      'depression',
      'addiction',
      'attachment',
      'autism',
      'adhd'
    ];

    // Filter to valid conditions only
    const filtered = conditions.filter(c => validConditions.includes(c.toLowerCase()));

    if (filtered.length === 0) return [];

    // Clear existing conditions for this user
    await pool.query(
      'DELETE FROM user_conditions WHERE user_id = $1',
      [userId]
    );

    // Insert new conditions
    const results = [];
    for (const condition of filtered) {
      const result = await pool.query(
        `INSERT INTO user_conditions (user_id, condition_name, created_at)
         VALUES ($1, $2, NOW())
         RETURNING *`,
        [userId, condition.toLowerCase()]
      );
      results.push(result.rows[0]);
    }

    return results;
  } catch (err) {
    console.error('[db:preferences] addUserConditions error:', err.message);
    throw err;
  }
}

/**
 * Get user conditions
 * @param {string} userId
 * @returns {Promise<array>}
 */
async function getUserConditions(userId) {
  try {
    const result = await pool.query(
      'SELECT condition_name FROM user_conditions WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );
    return result.rows.map(r => r.condition_name);
  } catch (err) {
    console.error('[db:preferences] getUserConditions error:', err.message);
    throw err;
  }
}

/**
 * Update user preferences
 * @param {string} userId
 * @param {object} updates
 * @returns {Promise<object>}
 */
async function updateUserPreferences(userId, updates) {
  try {
    const allowed = [
      'language_style',
      'tone',
      'tracking_depth',
      'insight_frequency',
      'show_why',
      'show_what',
      'show_meaning',
      'show_action'
    ];

    // Build dynamic query
    const setClauses = [];
    const values = [userId];
    let paramIdx = 2;

    for (const key of allowed) {
      if (key in updates) {
        setClauses.push(`${key} = $${paramIdx++}`);
        values.push(updates[key]);
      }
    }

    if (setClauses.length === 0) {
      return await getUserPreferences(userId);
    }

    const result = await pool.query(
      `UPDATE user_preferences 
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  } catch (err) {
    console.error('[db:preferences] updateUserPreferences error:', err.message);
    throw err;
  }
}

module.exports = {
  storeUserPreferences,
  getUserPreferences,
  addUserConditions,
  getUserConditions,
  updateUserPreferences,
};
