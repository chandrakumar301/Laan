-- ============================================
-- SECURE CHAT SYSTEM - DATA ISOLATION
-- ============================================
-- 1. CONVERSATIONS TABLE (1-to-1 user-admin only)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    admin_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    admin_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    -- Ensure only one conversation per user-admin pair
    UNIQUE(user_id, admin_id),
    CHECK (user_id != admin_id)
);
-- 2. CHAT_MESSAGES TABLE (With strict sender/receiver validation)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    message_text TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    -- 'sent', 'delivered', 'read'
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Note: Sender/receiver validation is enforced by RLS policies, not CHECK constraints
-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_admin_id ON conversations(admin_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_email ON conversations(user_email);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_id ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON chat_messages(is_read)
WHERE NOT is_read;
-- 4. ROW LEVEL SECURITY (RLS) - CONVERSATIONS TABLE
-- NOTE: RLS is DISABLED for development/testing
-- In production, uncomment the RLS sections below and set NODE_ENV=production in server
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
-- PRODUCTION RLS POLICIES (commented out for dev testing)
-- Uncomment these in production after configuring auth properly
/*
 ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
 -- Users can see their own conversations
 CREATE POLICY "Users can see their conversations" ON conversations FOR
 SELECT USING (
 auth.uid() = user_id
 OR auth.uid() = admin_id
 );
 -- Admin can see all conversations (if logged in as admin)
 CREATE POLICY "Admin can see all conversations" ON conversations FOR
 SELECT USING (
 auth.jwt()->>'email' = 'edufund0099@gmail.com'
 );
 -- Users can only create conversations if one party is admin
 CREATE POLICY "Can create conversation with admin" ON conversations FOR
 INSERT WITH CHECK (auth.uid() = user_id);
 -- Only allow updates to last_message_at
 CREATE POLICY "Update conversation timestamps" ON conversations FOR
 UPDATE USING (
 auth.uid() = user_id
 OR auth.uid() = admin_id
 ) WITH CHECK (
 auth.uid() = user_id
 OR auth.uid() = admin_id
 );
 -- 5. ROW LEVEL SECURITY (RLS) - MESSAGES TABLE
 -- NOTE: RLS is DISABLED for development/testing
 ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
 
 -- PRODUCTION RLS POLICIES (commented out for dev testing)
 /*
 ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
 -- Users can only see messages in their conversations
 CREATE POLICY "Users can see messages in their conversations" ON chat_messages FOR
 SELECT USING (
 EXISTS (
 SELECT 1
 FROM conversations c
 WHERE c.id = conversation_id
 AND (
 c.user_id = auth.uid()
 OR c.admin_id = auth.uid()
 )
 )
 );
 -- Users can only insert messages if they are a participant
 CREATE POLICY "Users can send messages in their conversations" ON chat_messages FOR
 INSERT WITH CHECK (
 auth.uid() = sender_id
 AND EXISTS (
 SELECT 1
 FROM conversations c
 WHERE c.id = conversation_id
 AND (
 c.user_id = auth.uid()
 OR c.admin_id = auth.uid()
 )
 AND (
 c.user_id = receiver_id
 OR c.admin_id = receiver_id
 )
 )
 );
 -- Users can update message read status
 CREATE POLICY "Users can mark messages as read" ON chat_messages FOR
 UPDATE USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);
 -- 6. STORED FUNCTION - Get unread count for user
 CREATE OR REPLACE FUNCTION get_unread_count(user_uuid UUID) RETURNS INTEGER AS $$ BEGIN RETURN (
 SELECT COUNT(*)
 FROM chat_messages
 WHERE receiver_id = user_uuid
 AND is_read = FALSE
 );
 END;
 $$ LANGUAGE plpgsql;
 -- 7. STORED FUNCTION - Mark messages as read
 CREATE OR REPLACE FUNCTION mark_messages_as_read(
 p_conversation_id UUID,
 p_user_id UUID
 ) RETURNS void AS $$ BEGIN
 UPDATE chat_messages
 SET is_read = TRUE,
 read_at = NOW(),
 status = 'read'
 WHERE conversation_id = p_conversation_id
 AND receiver_id = p_user_id
 AND is_read = FALSE;
 END;
 $$ LANGUAGE plpgsql;