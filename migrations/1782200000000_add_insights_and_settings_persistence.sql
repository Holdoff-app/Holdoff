-- Ensure relationship insights and settings selections have durable tables.
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  language_style VARCHAR(20) DEFAULT 'clinical',
  tone VARCHAR(20) DEFAULT 'direct',
  tracking_depth VARCHAR(20) DEFAULT 'moderate',
  insight_frequency VARCHAR(20) DEFAULT 'daily',
  show_why BOOLEAN DEFAULT true,
  show_what BOOLEAN DEFAULT true,
  show_meaning BOOLEAN DEFAULT true,
  show_action BOOLEAN DEFAULT true,
  onboarded BOOLEAN DEFAULT false,
  preferences_version VARCHAR(10) DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS pattern_tracking_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS spiral_tracking_enabled BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS user_conditions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condition_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, condition_name)
);

CREATE INDEX IF NOT EXISTS idx_user_conditions_user_id ON user_conditions(user_id);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  duration_days INT,
  phone_number VARCHAR(30),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);

CREATE TABLE IF NOT EXISTS message_history (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id INT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction VARCHAR(20),
  pattern_name VARCHAR(100),
  verdict VARCHAR(20),
  hour_of_day INT,
  day_of_week INT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_history_user_contact ON message_history(user_id, contact_id);

CREATE TABLE IF NOT EXISTS relationship_analysis (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id INT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  analysis_text TEXT,
  health_score INT,
  attachment_pattern VARCHAR(100),
  exit_warning BOOLEAN DEFAULT false,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relationship_analysis_user_contact ON relationship_analysis(user_id, contact_id);

CREATE TABLE IF NOT EXISTS contact_insights (
  id SERIAL PRIMARY KEY,
  contact_id INT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE UNIQUE,
  red_flags JSONB DEFAULT '[]',
  yellow_flags JSONB DEFAULT '[]',
  green_flags JSONB DEFAULT '[]',
  risk_level VARCHAR(20) DEFAULT 'Medium',
  trust_level VARCHAR(20) DEFAULT 'Stable',
  attachment_style_fit VARCHAR(50),
  communication_style_match INT DEFAULT 0,
  compatibility_score INT DEFAULT 0,
  compatibility_summary TEXT DEFAULT '',
  last_analyzed_message TEXT,
  analysis_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_insights
  ADD COLUMN IF NOT EXISTS compatibility_summary TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_contact_insights_contact_id ON contact_insights(contact_id);
