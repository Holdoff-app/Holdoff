-- Add phone_number to contacts table so users can store numbers and use the in-app dialer.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
