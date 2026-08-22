-- Add onboarding_completed_at column to users table.
-- Stamped once when the user completes or skips the post-signup onboarding flow.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
