/**
 * Notification preferences — push subscription + reminder settings.
 * Owns: notification_preferences table (per-user VAPID sub, reminder_time, quiet_hours).
 * Does NOT own: service worker push logic, VAPID key generation.
 */
const { pool } = require('./index');

/** Upsert push subscription for a user. */
async function upsertSubscription(userId, subscription) {
  const { rows } = await pool.query(
    `INSERT INTO notification_preferences (user_id, subscription, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       subscription = EXCLUDED.subscription,
       updated_at = NOW()
     RETURNING user_id`,
    [userId, JSON.stringify(subscription)]
  );
  return rows[0]?.user_id || null;
}

/** Get notification preferences for a user. */
async function getPreferences(userId) {
  const { rows } = await pool.query(
    `SELECT reminder_time, enabled, quiet_hours, subscription, created_at, updated_at
     FROM notification_preferences WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

/** Update reminder time and/or enabled state. */
async function updatePreferences(userId, { reminderTime, enabled, quietHours }) {
  const sets = ['updated_at = NOW()'];
  const vals = [userId];
  let idx = 2;

  if (reminderTime !== undefined) { sets.push(`reminder_time = $${idx++}`); vals.push(reminderTime); }
  if (enabled !== undefined)       { sets.push(`enabled = $${idx++}`);       vals.push(enabled);       }
  if (quietHours !== undefined)     { sets.push(`quiet_hours = $${idx++}`);   vals.push(JSON.stringify(quietHours)); }

  const { rows } = await pool.query(
    `UPDATE notification_preferences SET ${sets.join(', ')}
     WHERE user_id = $1
     RETURNING user_id, reminder_time, enabled, quiet_hours`,
    vals
  );
  return rows[0] || null;
}

/** Remove push subscription (unsubscribe). */
async function deleteSubscription(userId) {
  await pool.query(
    `UPDATE notification_preferences
     SET subscription = NULL, enabled = FALSE, updated_at = NOW()
     WHERE user_id = $1`,
    [userId]
  );
}

/** Check if user has an active subscription. */
async function hasActiveSubscription(userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM notification_preferences
     WHERE user_id = $1 AND enabled = TRUE AND subscription IS NOT NULL
     LIMIT 1`,
    [userId]
  );
  return rows.length > 0;
}

module.exports = {
  upsertSubscription,
  getPreferences,
  updatePreferences,
  deleteSubscription,
  hasActiveSubscription,
};