/**
 * Relationship anatomy queries — contacts, message_history, relationship_analysis.
 * Owns: contacts, message_history, relationship_analysis tables.
 */
const { pool } = require('./index');

// ── contacts ──────────────────────────────────────────────────────────────────

async function createContact({ userId, displayName, relationship, durationDays, phoneNumber }) {
  const { rows } = await pool.query(
    `INSERT INTO contacts (user_id, display_name, relationship, duration_days, phone_number)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, displayName, relationship || null, durationDays || null, phoneNumber || null]
  );
  return rows[0];
}

async function getContact(contactId, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM contacts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [contactId, userId]
  );
  return rows[0] || null;
}

async function getContacts(userId, { includeDeleted = false } = {}) {
  const where = includeDeleted ? 'user_id = $1' : 'user_id = $1 AND deleted_at IS NULL';
  const { rows } = await pool.query(
    `SELECT * FROM contacts WHERE ${where} ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function updateContact(contactId, userId, { displayName, relationship, durationDays, isSpam, spamReports, phoneNumber }) {
  const { rows } = await pool.query(
    `UPDATE contacts SET
       display_name = COALESCE($3, display_name),
       relationship = COALESCE($4, relationship),
       duration_days = COALESCE($5, duration_days),
       is_spam = COALESCE($6, is_spam),
       spam_reports = COALESCE($7, spam_reports),
       phone_number = COALESCE($8, phone_number),
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [contactId, userId, displayName, relationship, durationDays, isSpam, spamReports, phoneNumber]
  );
  return rows[0] || null;
}

async function softDeleteContact(contactId, userId) {
  const { rows } = await pool.query(
    `UPDATE contacts SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [contactId, userId]
  );
  return rows.length > 0;
}

// ── message_history ───────────────────────────────────────────────────────────

async function addMessage({ userId, contactId, direction, patternName, verdict, sentAt, metadata }) {
  const sentDate = sentAt ? new Date(sentAt) : new Date();
  const hour = sentDate.getHours();
  const dow = sentDate.getDay();
  const { rows } = await pool.query(
    `INSERT INTO message_history (user_id, contact_id, direction, pattern_name, verdict, hour_of_day, day_of_week, metadata, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [userId, contactId, direction, patternName || null, verdict || null, hour, dow, metadata || '{}', sentDate]
  );
  return rows[0];
}

async function getMessageHistory(userId, contactId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, direction, pattern_name, verdict, hour_of_day, day_of_week, metadata, sent_at, created_at
     FROM message_history
     WHERE user_id = $1 AND contact_id = $2
     ORDER BY sent_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, contactId, limit, offset]
  );
  return rows;
}

async function getMessageStats(userId, contactId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE direction = 'sent') AS sent_count,
       COUNT(*) FILTER (WHERE direction = 'received') AS received_count,
       COUNT(*) FILTER (WHERE verdict = 'HOLD') AS hold_count,
       COUNT(*) FILTER (WHERE verdict = 'REWRITE') AS rewrite_count,
       COUNT(*) FILTER (WHERE hour_of_day BETWEEN 22 AND 23 OR hour_of_day BETWEEN 0 AND 5) AS night_count,
       COUNT(*) FILTER (WHERE day_of_week IN (0, 6)) AS weekend_count
     FROM message_history
     WHERE user_id = $1 AND contact_id = $2`,
    [userId, contactId]
  );
  return rows[0];
}

// ── relationship_analysis ───────────────────────────────────────────────────

async function saveAnalysis({ userId, contactId, analysisText, healthScore, attachmentPattern, exitWarning }) {
  const { rows } = await pool.query(
    `INSERT INTO relationship_analysis (user_id, contact_id, analysis_text, health_score, attachment_pattern, exit_warning)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, contactId, analysisText, healthScore || null, attachmentPattern || null, exitWarning || null]
  );
  return rows[0];
}

async function getLatestAnalysis(userId, contactId) {
  const { rows } = await pool.query(
    `SELECT * FROM relationship_analysis
     WHERE user_id = $1 AND contact_id = $2
     ORDER BY analyzed_at DESC
     LIMIT 1`,
    [userId, contactId]
  );
  return rows[0] || null;
}

async function getAnalysisHistory(userId, contactId, { limit = 12 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, health_score, attachment_pattern, exit_warning, analyzed_at
     FROM relationship_analysis
     WHERE user_id = $1 AND contact_id = $2
     ORDER BY analyzed_at DESC
     LIMIT $3`,
    [userId, contactId, limit]
  );
  return rows;
}

// ── contact_insights ──────────────────────────────────────────────────────────

async function getContactInsights(userId, contactId) {
  const { rows } = await pool.query(
    `SELECT ci.*
     FROM contact_insights ci
     INNER JOIN contacts c ON c.id = ci.contact_id
     WHERE ci.contact_id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL`,
    [contactId, userId]
  );
  return rows[0] || null;
}

async function upsertContactInsights(userId, contactId, insights) {
  const contact = await getContact(contactId, userId);
  if (!contact) return null;

  const {
    redFlags = [],
    yellowFlags = [],
    greenFlags = [],
    riskLevel = 'Medium',
    trustLevel = 'Stable',
    attachmentStyleFit = null,
    communicationStyleMatch = 0,
    compatibilityScore = 0,
    compatibilitySummary = '',
    lastAnalyzedMessage = null,
    analysisTimestamp = new Date(),
  } = insights || {};

  const { rows } = await pool.query(
    `INSERT INTO contact_insights (
       contact_id, red_flags, yellow_flags, green_flags,
       risk_level, trust_level, attachment_style_fit,
       communication_style_match, compatibility_score, compatibility_summary,
       last_analyzed_message, analysis_count, updated_at
     )
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, 1, $12)
     ON CONFLICT (contact_id) DO UPDATE
     SET red_flags = EXCLUDED.red_flags,
         yellow_flags = EXCLUDED.yellow_flags,
         green_flags = EXCLUDED.green_flags,
         risk_level = EXCLUDED.risk_level,
         trust_level = EXCLUDED.trust_level,
         attachment_style_fit = EXCLUDED.attachment_style_fit,
         communication_style_match = EXCLUDED.communication_style_match,
         compatibility_score = EXCLUDED.compatibility_score,
         compatibility_summary = EXCLUDED.compatibility_summary,
         last_analyzed_message = EXCLUDED.last_analyzed_message,
         analysis_count = contact_insights.analysis_count + 1,
         updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      contactId,
      JSON.stringify(redFlags),
      JSON.stringify(yellowFlags),
      JSON.stringify(greenFlags),
      riskLevel,
      trustLevel,
      attachmentStyleFit,
      Number(communicationStyleMatch) || 0,
      Number(compatibilityScore) || 0,
      compatibilitySummary || '',
      lastAnalyzedMessage,
      analysisTimestamp,
    ]
  );
  return rows[0] || null;
}

// ── spam & call tracking ──────────────────────────────────────────────────────

async function markAsSpam(contactId, userId) {
  const { rows } = await pool.query(
    `UPDATE contacts SET
       is_spam = true,
       spam_reports = COALESCE(spam_reports, 0) + 1,
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id, is_spam, spam_reports`,
    [contactId, userId]
  );
  return rows[0] || null;
}

async function getSpamContacts(userId) {
  const { rows } = await pool.query(
    `SELECT id, display_name, spam_reports, is_spam FROM contacts
     WHERE user_id = $1 AND is_spam = true AND deleted_at IS NULL
     ORDER BY spam_reports DESC`,
    [userId]
  );
  return rows;
}

async function addCall({ userId, contactId, direction, duration, timestamp }) {
  const callTime = timestamp ? new Date(timestamp) : new Date();
  const hour = callTime.getHours();
  const { rows } = await pool.query(
    `INSERT INTO call_history (user_id, contact_id, direction, duration_seconds, hour_of_day, called_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, direction, duration_seconds, called_at`,
    [userId, contactId, direction, duration || 0, hour, callTime]
  );
  return rows[0];
}

async function getCallHistory(userId, contactId, { limit = 20 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, direction, duration_seconds, hour_of_day, called_at
     FROM call_history
     WHERE user_id = $1 AND contact_id = $2
     ORDER BY called_at DESC
     LIMIT $3`,
    [userId, contactId, limit]
  );
  return rows;
}

// ── sobriety lock detection ────────────────────────────────────────────────────

/**
 * Detect drunk texting patterns:
 * - Late night (10pm - 6am)
 * - Multiple rapid messages (3+ in 5 min)
 * - Typos/emoji spam (broken words, emoji clusters)
 */
async function detectDrunkTexting(userId, contactId, messageBody, sentTime) {
  const hour = new Date(sentTime).getHours();
  const isLateNight = hour >= 22 || hour <= 6;
  
  // Check for typo indicators (repeated chars, missing vowels, etc)
  const hasTypos = /(.)\1{2,}|[aeiou]{0,1}[bcdfghjklmnpqrstvwxyz]{3,}/i.test(messageBody);
  
  // Check for emoji spam (3+ emojis in 10 chars)
  const emojiCount = (messageBody.match(/[\p{Emoji_Presentation}]/gu) || []).length;
  const hasEmojiSpam = emojiCount >= 3 && messageBody.length < 50;
  
  // Get recent message velocity
  const { rows } = await pool.query(
    `SELECT COUNT(*) as recent_count
     FROM message_history
     WHERE user_id = $1 AND contact_id = $2 AND direction = 'sent'
       AND sent_at > NOW() - INTERVAL '5 minutes'`,
    [userId, contactId]
  );
  
  const rapidFire = rows[0]?.recent_count >= 3;
  
  // Score the risk
  let riskScore = 0;
  if (isLateNight) riskScore += 30;
  if (hasTypos) riskScore += 20;
  if (hasEmojiSpam) riskScore += 25;
  if (rapidFire) riskScore += 25;
  
  return {
    riskScore,
    flags: {
      isLateNight,
      hasTypos,
      hasEmojiSpam,
      rapidFire
    },
    shouldWarn: riskScore >= 50,
    shouldLock: riskScore >= 75
  };
}

module.exports = {
  createContact,
  getContact,
  getContacts,
  updateContact,
  softDeleteContact,
  addMessage,
  getMessageHistory,
  getMessageStats,
  saveAnalysis,
  getLatestAnalysis,
  getAnalysisHistory,
  getContactInsights,
  upsertContactInsights,
  markAsSpam,
  getSpamContacts,
  addCall,
  getCallHistory,
  detectDrunkTexting,
};
