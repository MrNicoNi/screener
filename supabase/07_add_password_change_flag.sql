-- ============================================
-- MIGRATION: Add must_change_password field
-- ============================================
-- This migration adds support for mandatory password change
-- for new users created in the system

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN users.must_change_password IS 'Flag to force user to change password on first login';

-- Index for quick lookup during authentication
CREATE INDEX IF NOT EXISTS idx_users_must_change_password 
ON users(must_change_password) 
WHERE must_change_password = TRUE;
