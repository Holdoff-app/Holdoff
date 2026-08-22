-- Rebuilds the schema that only ever existed on the old ad-hoc database.
-- Every table below is queried by shipping code but was created by no migration
-- and no runtime DDL, so a fresh database could not run the app.

-- users: columns referenced across db/users.js, routes/auth.js, routes/users.js
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS membership_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS attachment_style VARCHAR(30),
  ADD COLUMN IF NOT EXISTS quiz_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paywall_hit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS winback_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_holds INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_rewrites INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verdict_style VARCHAR(30),
  ADD COLUMN IF NOT EXISTS reminder_time VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
  ON users (email_verification_token) WHERE email_verification_token IS NOT NULL;

-- contacts: written by db/contacts.js reportSpam/updateContact, never created
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS spam_reports INT NOT NULL DEFAULT 0;

-- routes/messaging.js upserts ON CONFLICT (user_id, display_name)
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_display_name_unique_idx
  ON contacts (user_id, display_name);

-- Billing -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(30),
  current_period_end TIMESTAMPTZ,
  membership_type VARCHAR(20),
  grace_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_email_unique_idx
  ON subscriptions (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription ON subscriptions (stripe_subscription_id);

CREATE TABLE IF NOT EXISTS magic_tokens (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens_token ON magic_tokens (token);

CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255),
  tier VARCHAR(50),
  amount NUMERIC(12, 2),
  currency VARCHAR(10) DEFAULT 'usd',
  payment_link TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  unsub_token VARCHAR(255),
  emailed_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_sweep
  ON abandoned_checkouts (status, created_at);
CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_email
  ON abandoned_checkouts (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_unsub
  ON abandoned_checkouts (unsub_token);

CREATE TABLE IF NOT EXISTS dunning_attempts (
  id SERIAL PRIMARY KEY,
  subscription_id VARCHAR(255),
  customer_id VARCHAR(255),
  email VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  failure_detected_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dunning_attempts_lookup
  ON dunning_attempts (subscription_id, status);

-- Growth / lifecycle email --------------------------------------------------

CREATE TABLE IF NOT EXISTS waitlist (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  source VARCHAR(50) DEFAULT 'landing',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique_idx ON waitlist (LOWER(email));

CREATE TABLE IF NOT EXISTS nurture_queue (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  email_step INT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nurture_queue_due
  ON nurture_queue (scheduled_at)
  WHERE sent_at IS NULL AND failed_at IS NULL;

CREATE TABLE IF NOT EXISTS detox_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  next_step INT NOT NULL DEFAULT 0,
  next_send_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_detox_subscribers_due
  ON detox_subscribers (next_send_at)
  WHERE unsubscribed = FALSE;

CREATE TABLE IF NOT EXISTS exit_intent_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(60) NOT NULL,
  email VARCHAR(255),
  device_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exit_intent_events_type_time
  ON exit_intent_events (event_type, created_at);

CREATE TABLE IF NOT EXISTS affiliates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  practice_handle VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  audience_size VARCHAR(50),
  aff_code VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliates_email_unique_idx ON affiliates (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates (aff_code);

-- Referrals ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  sender_email VARCHAR(255),
  sender_device VARCHAR(255),
  recipient_email VARCHAR(255),
  note TEXT,
  utm_token VARCHAR(64),
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_utm_token ON referrals (utm_token);
CREATE INDEX IF NOT EXISTS idx_referrals_sender_email ON referrals (sender_email, created_at);
CREATE INDEX IF NOT EXISTS idx_referrals_sender_device ON referrals (sender_device, created_at);

CREATE TABLE IF NOT EXISTS user_referral_stats (
  id SERIAL PRIMARY KEY,
  sender_email VARCHAR(255) NOT NULL UNIQUE,
  daily_send_count INT NOT NULL DEFAULT 0,
  daily_reset_at TIMESTAMPTZ,
  total_referrals INT NOT NULL DEFAULT 0,
  total_converted INT NOT NULL DEFAULT 0,
  reward_credits INT NOT NULL DEFAULT 0,
  trial_days_granted INT NOT NULL DEFAULT 0,
  lifetime_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id SERIAL PRIMARY KEY,
  sender_email VARCHAR(255) NOT NULL,
  tier VARCHAR(20) NOT NULL,
  reward_type VARCHAR(30),
  reward_value INT,
  referral_count INT,
  unlocked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_rewards_sender_tier_unique_idx
  ON referral_rewards (sender_email, tier);

-- Journal, verdicts, quiz ----------------------------------------------------

CREATE TABLE IF NOT EXISTS verdict_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  message_length INT,
  attachment_style_snapshot VARCHAR(30),
  verdict_source VARCHAR(40),
  verdict VARCHAR(20),
  latency_ms INT,
  error_message TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verdict_logs_user ON verdict_logs (user_id);

CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_text TEXT,
  message_text TEXT,
  outcome TEXT,
  pattern_name VARCHAR(100),
  reframe TEXT,
  verdict VARCHAR(20),
  hour_of_day INT,
  source VARCHAR(30) DEFAULT 'manual',
  verdict_log_id INT REFERENCES verdict_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_time
  ON journal_entries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS journal_streaks (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_entry_date DATE,
  total_entries INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verdict_history (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verdict VARCHAR(20),
  pattern_name VARCHAR(100),
  feedback_snippet TEXT,
  attachment_style VARCHAR(30),
  source VARCHAR(30) DEFAULT 'filter',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verdict_history_user_time
  ON verdict_history (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_verdict_stats (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_verdicts INT NOT NULL DEFAULT 0,
  last_verdict_at TIMESTAMPTZ,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attachment_style_quiz_results (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  primary_style VARCHAR(30),
  secondary_style VARCHAR(30),
  scores JSONB,
  answer_data JSONB,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_attachment_responses (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  selected_option VARCHAR(5),
  scores JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, question_number)
);

CREATE TABLE IF NOT EXISTS user_attachment_profiles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  anxious_score INT NOT NULL DEFAULT 0,
  avoidant_score INT NOT NULL DEFAULT 0,
  fearful_score INT NOT NULL DEFAULT 0,
  secure_score INT NOT NULL DEFAULT 0,
  dominant_style VARCHAR(30),
  secondary_style VARCHAR(30),
  quiz_completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sharing, notifications, ops ------------------------------------------------

CREATE TABLE IF NOT EXISTS share_cards (
  id SERIAL PRIMARY KEY,
  token VARCHAR(32) NOT NULL UNIQUE,
  streak_count INT NOT NULL DEFAULT 0,
  verdict_type VARCHAR(20) DEFAULT 'HOLD',
  pattern_name VARCHAR(100),
  reframe_line TEXT,
  ref_token VARCHAR(64),
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB,
  reminder_time VARCHAR(20),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS healthchecks (
  id SERIAL PRIMARY KEY,
  status VARCHAR(30),
  response_time_ms INT,
  http_status INT,
  body_snippet TEXT,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_healthchecks_checked_at ON healthchecks (checked_at DESC);

CREATE TABLE IF NOT EXISTS call_history (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id INT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction VARCHAR(20),
  duration_seconds INT,
  hour_of_day INT,
  called_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_history_user_contact
  ON call_history (user_id, contact_id, called_at DESC);
