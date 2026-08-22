/**
 * Community DB helpers — ensures tables exist on first use.
 */
const { pool } = require('./index');

async function ensureCommunityTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      display_name TEXT NOT NULL,
      content TEXT NOT NULL,
      mood_level INT,
      mood_label TEXT,
      reactions INT NOT NULL DEFAULT 0,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC)
    WHERE deleted_at IS NULL
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_poems (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      display_name TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      week_of DATE NOT NULL,
      likes INT NOT NULL DEFAULT 0,
      won_week BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_community_poems_week ON community_poems(week_of DESC)
  `);
}

module.exports = { ensureCommunityTables };
