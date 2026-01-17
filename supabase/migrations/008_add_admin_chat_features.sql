-- ===================== ADD MESSAGE READ STATUS =====================
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
-- ===================== ADD USER ROLES =====================
-- Add role column to users profile if not exists
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON chat_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);