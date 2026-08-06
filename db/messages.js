/**
 * Message & contact database layer for HoldOff messaging app.
 * Handles threads, messages, contacts, spiral lock state, and sent message history.
 */

const pool = require('./pool');

/**
 * CONTACT MANAGEMENT
 */

/**
 * Create or update a contact.
 */
async function upsertContact(userId, { name, phoneNumber, isFavorited }) {
  const query = `
    INSERT INTO user_contacts (user_id, name, phone_number, is_favorited)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (phone_number)
    DO UPDATE SET name = COALESCE($2, user_contacts.name),
                  is_favorited = COALESCE($4, user_contacts.is_favorited)
    RETURNING id, name, phone_number, is_favorited, last_messaged_at;
  `;
  const result = await pool.query(query, [userId, name, phoneNumber, isFavorited ?? false]);
  return result.rows[0];
}

/**
 * Get all contacts for a user, sorted by recency.
 */
async function getContactsByUser(userId) {
  const query = `
    SELECT id, name, phone_number, is_favorited, last_messaged_at
    FROM user_contacts
    WHERE user_id = $1
    ORDER BY is_favorited DESC, last_messaged_at DESC NULLS LAST, name ASC;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

/**
 * Get a single contact by ID.
 */
async function getContactById(contactId) {
  const query = `
    SELECT id, name, phone_number, is_favorited, last_messaged_at
    FROM user_contacts
    WHERE id = $1;
  `;
  const result = await pool.query(query, [contactId]);
  return result.rows[0];
}

/**
 * Delete a contact.
 */
async function deleteContact(contactId) {
  const query = `DELETE FROM user_contacts WHERE id = $1;`;
  await pool.query(query, [contactId]);
}

/**
 * THREAD MANAGEMENT
 */

/**
 * Get or create a message thread for a user + contact.
 */
async function getOrCreateThread(userId, contactId) {
  const contact = await getContactById(contactId);
  if (!contact) throw new Error('Contact not found');

  const query = `
    INSERT INTO message_threads (user_id, contact_id, contact_phone, last_message_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, contact_id) DO UPDATE
    SET last_message_at = NOW()
    RETURNING id, user_id, contact_id, contact_phone, last_message_at;
  `;
  const result = await pool.query(query, [userId, contactId, contact.phone_number]);
  return result.rows[0];
}

/**
 * Get all threads for a user (sorted by recency).
 */
async function getThreadsByUser(userId) {
  const query = `
    SELECT 
      mt.id, mt.user_id, mt.contact_id, mt.contact_phone, mt.last_message_at,
      uc.name, uc.phone_number, uc.is_favorited,
      (SELECT body FROM messages WHERE thread_id = mt.id ORDER BY timestamp DESC LIMIT 1) as last_message_preview
    FROM message_threads mt
    LEFT JOIN user_contacts uc ON mt.contact_id = uc.id
    WHERE mt.user_id = $1
    ORDER BY mt.last_message_at DESC;
  `;
  try {
    const result = await pool.query(query, [userId]);
    console.log('[db] getThreadsByUser for user', userId, '— returning', result.rows.length, 'threads');
    return result.rows;
  } catch (err) {
    console.error('[db] getThreadsByUser query failed:', err.message, 'code:', err.code);
    throw err;
  }
}

/**
 * Get a single thread by ID.
 */
async function getThreadById(threadId) {
  const query = `
    SELECT 
      mt.id, mt.user_id, mt.contact_id, mt.contact_phone, mt.last_message_at,
      uc.name, uc.phone_number, uc.is_favorited
    FROM message_threads mt
    LEFT JOIN user_contacts uc ON mt.contact_id = uc.id
    WHERE mt.id = $1;
  `;
  const result = await pool.query(query, [threadId]);
  return result.rows[0];
}

/**
 * MESSAGE RETRIEVAL & STORAGE
 */

/**
 * Get messages for a thread (most recent first, limit 50 by default).
 */
async function getMessagesByThread(threadId, limit = 50) {
  const query = `
    SELECT id, thread_id, sender_type, body, external_id, timestamp, created_at
    FROM messages
    WHERE thread_id = $1
    ORDER BY timestamp DESC
    LIMIT $2;
  `;
  const result = await pool.query(query, [threadId, limit]);
  return result.rows.reverse(); // Return oldest first for UI
}

/**
 * Insert a new message into a thread.
 * senderType: 'user' | 'contact'
 */
async function insertMessage(threadId, { senderType, body, externalId, timestamp }) {
  const query = `
    INSERT INTO messages (thread_id, sender_type, body, external_id, timestamp)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, thread_id, sender_type, body, external_id, timestamp, created_at;
  `;
  const result = await pool.query(query, [threadId, senderType, body, externalId, timestamp || new Date()]);
  
  // Update thread's last_message_at
  await pool.query(
    'UPDATE message_threads SET last_message_at = NOW() WHERE id = $1',
    [threadId]
  );
  
  return result.rows[0];
}

/**
 * SPIRAL LOCK STATE
 */

/**
 * Get spiral lock state for a thread.
 */
async function getSpiralLockState(threadId) {
  const query = `
    SELECT id, thread_id, is_locked, locked_until, spiral_count, quiz_passed
    FROM spiral_lock_state
    WHERE thread_id = $1;
  `;
  const result = await pool.query(query, [threadId]);
  return result.rows[0];
}

/**
 * Create or update spiral lock state.
 */
async function updateSpiralLockState(threadId, { isLocked, lockedUntil, spiralCount, quizPassed }) {
  const query = `
    INSERT INTO spiral_lock_state (thread_id, is_locked, locked_until, spiral_count, quiz_passed)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (thread_id) DO UPDATE
    SET is_locked = COALESCE($2, spiral_lock_state.is_locked),
        locked_until = COALESCE($3, spiral_lock_state.locked_until),
        spiral_count = COALESCE($4, spiral_lock_state.spiral_count),
        quiz_passed = COALESCE($5, spiral_lock_state.quiz_passed)
    RETURNING id, thread_id, is_locked, locked_until, spiral_count, quiz_passed;
  `;
  const result = await pool.query(query, [threadId, isLocked, lockedUntil, spiralCount, quizPassed]);
  return result.rows[0];
}

/**
 * Increment spiral count and activate lock if threshold reached.
 * Returns updated spiral state.
 */
async function incrementSpiralCount(threadId, verdict) {
  let state = await getSpiralLockState(threadId);
  
  if (!state) {
    state = await updateSpiralLockState(threadId, {
      isLocked: false,
      lockedUntil: null,
      spiralCount: 0,
      quizPassed: false,
    });
  }

  const newCount = (state.spiral_count || 0) + (verdict === 'HOLD' ? 1 : 0);
  
  // Activate lock after 2 consecutive HOLD verdicts
  const shouldLock = newCount >= 2;
  const lockedUntil = shouldLock ? new Date(Date.now() + 30 * 60 * 1000) : null;

  return updateSpiralLockState(threadId, {
    isLocked: shouldLock,
    lockedUntil,
    spiralCount: newCount,
    quizPassed: false,
  });
}

/**
 * Reset spiral count (on successful send or timer expiry).
 */
async function resetSpiralCount(threadId) {
  return updateSpiralLockState(threadId, {
    isLocked: false,
    lockedUntil: null,
    spiralCount: 0,
    quizPassed: false,
  });
}

/**
 * Mark quiz as passed to allow send.
 */
async function markQuizPassed(threadId) {
  return updateSpiralLockState(threadId, {
    quizPassed: true,
  });
}

/**
 * SENT MESSAGES & VERDICTS
 */

/**
 * Log a sent message with its verdict.
 */
async function logSentMessage(threadId, { originalText, verdict, verdictJson, finalText }) {
  const query = `
    INSERT INTO sent_messages (thread_id, original_text, verdict, verdict_json, final_text, sent_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING id, thread_id, original_text, verdict, verdict_json, final_text, sent_at;
  `;
  const result = await pool.query(query, [threadId, originalText, verdict, verdictJson, finalText]);
  return result.rows[0];
}

/**
 * Get sent message history for a thread.
 */
async function getSentMessageHistory(threadId, limit = 20) {
  const query = `
    SELECT id, thread_id, original_text, verdict, verdict_json, final_text, sent_at
    FROM sent_messages
    WHERE thread_id = $1
    ORDER BY sent_at DESC
    LIMIT $2;
  `;
  const result = await pool.query(query, [threadId, limit]);
  return result.rows;
}

/**
 * CONTACT INSIGHTS & RELATIONSHIP TRACKING
 */

/**
 * Store or update contact insights after interpreter analysis.
 */
async function upsertContactInsights(contactId, insights) {
  const {
    redFlags = [],
    yellowFlags = [],
    greenFlags = [],
    riskLevel = 'Medium',
    trustLevel = 'Stable',
    attachmentStyleFit = null,
    communicationStyleMatch = 0,
    compatibilityScore = 0,
    lastAnalyzedMessage = null,
    analysisTimestamp = new Date(),
  } = insights;

  const query = `
    INSERT INTO contact_insights (
      contact_id, red_flags, yellow_flags, green_flags,
      risk_level, trust_level, attachment_style_fit,
      communication_style_match, compatibility_score,
      last_analyzed_message, analysis_count, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11)
    ON CONFLICT (contact_id) DO UPDATE
    SET red_flags = $2,
        yellow_flags = $3,
        green_flags = $4,
        risk_level = $5,
        trust_level = $6,
        attachment_style_fit = $7,
        communication_style_match = $8,
        compatibility_score = $9,
        last_analyzed_message = $10,
        analysis_count = contact_insights.analysis_count + 1,
        updated_at = $11
    RETURNING *;
  `;

  const result = await pool.query(query, [
    contactId,
    JSON.stringify(redFlags),
    JSON.stringify(yellowFlags),
    JSON.stringify(greenFlags),
    riskLevel,
    trustLevel,
    attachmentStyleFit,
    communicationStyleMatch,
    compatibilityScore,
    lastAnalyzedMessage,
    analysisTimestamp,
  ]);
  return result.rows[0];
}

/**
 * Get full insights profile for a contact.
 */
async function getContactInsights(contactId) {
  const query = `
    SELECT *
    FROM contact_insights
    WHERE contact_id = $1;
  `;
  const result = await pool.query(query, [contactId]);
  return result.rows[0];
}

/**
 * USER CONDITIONS
 */

/**
 * Add a condition to a user's profile.
 */
async function addUserCondition(userId, condition) {
  const query = `
    INSERT INTO user_conditions (user_id, condition_name)
    VALUES ($1, $2)
    ON CONFLICT (user_id, condition_name) DO NOTHING
    RETURNING id, user_id, condition_name;
  `;
  const result = await pool.query(query, [userId, condition]);
  return result.rows[0];
}

/**
 * Get all conditions for a user.
 */
async function getUserConditions(userId) {
  const query = `
    SELECT id, user_id, condition_name
    FROM user_conditions
    WHERE user_id = $1
    ORDER BY created_at ASC;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows.map(r => r.condition_name);
}

/**
 * Delete a condition from a user's profile.
 */
async function removeUserCondition(userId, condition) {
  const query = `
    DELETE FROM user_conditions
    WHERE user_id = $1 AND condition_name = $2;
  `;
  await pool.query(query, [userId, condition]);
}

/**
 * Update all conditions for a user (replace existing).
 */
async function setUserConditions(userId, conditions) {
  // Delete all existing
  await pool.query('DELETE FROM user_conditions WHERE user_id = $1', [userId]);
  
  // Insert new ones
  for (const condition of conditions) {
    await addUserCondition(userId, condition);
  }
}

/**
 * TABLE INITIALIZATION (for first-time setup)
 */

async function initializeTables() {
  try {
    // Contacts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_contacts (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255),
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        is_favorited BOOLEAN DEFAULT false,
        last_messaged_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, phone_number)
      );
      CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON user_contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_contacts_phone ON user_contacts(phone_number);
    `);

    // Threads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_threads (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_id INT REFERENCES user_contacts(id) ON DELETE SET NULL,
        contact_phone VARCHAR(20),
        last_message_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, contact_id)
      );
      CREATE INDEX IF NOT EXISTS idx_threads_user_id ON message_threads(user_id);
      CREATE INDEX IF NOT EXISTS idx_threads_contact_id ON message_threads(contact_id);
    `);

    // Messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        thread_id INT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
        sender_type VARCHAR(20) NOT NULL, -- 'user' or 'contact'
        body TEXT,
        external_id VARCHAR(255),
        timestamp TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);

    // Spiral lock state table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spiral_lock_state (
        id SERIAL PRIMARY KEY,
        thread_id INT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE UNIQUE,
        is_locked BOOLEAN DEFAULT false,
        locked_until TIMESTAMP,
        spiral_count INT DEFAULT 0,
        quiz_passed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_spiral_thread_id ON spiral_lock_state(thread_id);
    `);

    // Sent messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sent_messages (
        id SERIAL PRIMARY KEY,
        thread_id INT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
        original_text TEXT,
        verdict VARCHAR(20), -- 'HOLD', 'SEND', 'REWRITE'
        verdict_json JSONB,
        final_text TEXT,
        sent_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sent_messages_thread_id ON sent_messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_sent_messages_sent_at ON sent_messages(sent_at);
    `);

    // User conditions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_conditions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        condition_name VARCHAR(50) NOT NULL, -- 'RSD', 'Anxiety', 'Depression', 'Addiction', 'Attachment_Styles'
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, condition_name)
      );
      CREATE INDEX IF NOT EXISTS idx_user_conditions_user_id ON user_conditions(user_id);
    `);

    // Contact insights table (relationship intelligence per contact)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_insights (
        id SERIAL PRIMARY KEY,
        contact_id INT NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE UNIQUE,
        red_flags JSONB DEFAULT '[]',
        yellow_flags JSONB DEFAULT '[]',
        green_flags JSONB DEFAULT '[]',
        risk_level VARCHAR(20) DEFAULT 'Medium', -- 'Low', 'Medium', 'High'
        trust_level VARCHAR(20) DEFAULT 'Stable', -- 'Growing', 'Stable', 'Declining'
        attachment_style_fit VARCHAR(50),
        communication_style_match INT DEFAULT 0, -- 0-100
        compatibility_score INT DEFAULT 0, -- 0-100
        last_analyzed_message TEXT,
        analysis_count INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_contact_insights_contact_id ON contact_insights(contact_id);
    `);

    console.log('[DB] All messaging tables initialized successfully');
  } catch (err) {
    console.error('[DB] Table initialization error:', err.message);
    throw err;
  }
}

module.exports = {
  // Contacts
  upsertContact,
  getContactsByUser,
  getContactById,
  deleteContact,

  // Threads
  getOrCreateThread,
  getThreadsByUser,
  getThreadById,

  // Messages
  getMessagesByThread,
  insertMessage,

  // Spiral Lock
  getSpiralLockState,
  updateSpiralLockState,
  incrementSpiralCount,
  resetSpiralCount,
  markQuizPassed,

  // Sent messages
  logSentMessage,
  getSentMessageHistory,

  // Contact insights
  upsertContactInsights,
  getContactInsights,

  // User conditions
  addUserCondition,
  getUserConditions,
  removeUserCondition,
  setUserConditions,

  // Init
  initializeTables,
};
