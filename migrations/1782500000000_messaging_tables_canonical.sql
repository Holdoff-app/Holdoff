-- These tables previously existed only as runtime CREATE TABLE IF NOT EXISTS
-- calls fired unawaited from server.js. Three of them had two conflicting
-- definitions (db/migrations.js vs db/messages.js) and whichever query won the
-- race decided the constraints, so upserts succeeded or threw nondeterministically.
-- Defining them here makes migrate.js the single source of truth; the runtime
-- calls still run and now no-op.

CREATE TABLE IF NOT EXISTS user_contacts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  phone_number VARCHAR(30),
  is_favorited BOOLEAN DEFAULT FALSE,
  last_messaged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Scoped per user, not global: two users may legitimately have the same
  -- number in their contacts.
  UNIQUE (user_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON user_contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_user_contacts_phone ON user_contacts (phone_number);

CREATE TABLE IF NOT EXISTS message_threads (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id INT REFERENCES user_contacts(id) ON DELETE SET NULL,
  contact_phone VARCHAR(30),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, contact_id)
);

-- CREATE TABLE above no-ops where the runtime DDL already created the table
-- without this constraint, so add it explicitly. getOrCreateThread() upserts
-- ON CONFLICT (user_id, contact_id) and throws without it.
DO $$
BEGIN
  ALTER TABLE message_threads ADD CONSTRAINT message_threads_user_contact_key
    UNIQUE (user_id, contact_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_message_threads_user_id ON message_threads (user_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_contact_id ON message_threads (contact_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message
  ON message_threads (last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  thread_id INT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL,
  body TEXT,
  external_id VARCHAR(255),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC);

CREATE TABLE IF NOT EXISTS spiral_lock_state (
  id SERIAL PRIMARY KEY,
  thread_id INT NOT NULL UNIQUE REFERENCES message_threads(id) ON DELETE CASCADE,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_until TIMESTAMPTZ,
  spiral_count INT NOT NULL DEFAULT 0,
  quiz_passed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spiral_lock_state_thread ON spiral_lock_state (thread_id);

CREATE TABLE IF NOT EXISTS sent_messages (
  id SERIAL PRIMARY KEY,
  thread_id INT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  original_text TEXT,
  verdict VARCHAR(20),
  verdict_json JSONB,
  final_text TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sent_messages_thread_id ON sent_messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_sent_at ON sent_messages (sent_at DESC);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_active
  ON auth_refresh_tokens (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active
  ON password_reset_tokens (expires_at) WHERE used_at IS NULL;

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
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created
  ON community_posts (created_at DESC) WHERE deleted_at IS NULL;

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
);

CREATE INDEX IF NOT EXISTS idx_community_poems_week ON community_poems (week_of DESC);

CREATE TABLE IF NOT EXISTS beta_testers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120),
  email VARCHAR(255) NOT NULL UNIQUE,
  device VARCHAR(100),
  why TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_testers_status ON beta_testers (status);
CREATE INDEX IF NOT EXISTS idx_beta_testers_email ON beta_testers (email);
