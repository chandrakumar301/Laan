-- ===================== CHAT TABLES =====================
-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);
-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
-- Blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);
-- User reports table
CREATE TABLE IF NOT EXISTS user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    message TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
-- ===================== INDEXES =====================
CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked ON blocked_users(blocked_id);
CREATE INDEX idx_user_reports_reporter ON user_reports(reporter_id);
CREATE INDEX idx_user_reports_reported ON user_reports(reported_id);
-- ===================== ROW LEVEL SECURITY (RLS) =====================
-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
-- Conversations: Users can only see their own conversations
CREATE POLICY "Users can view their own conversations" ON conversations FOR
SELECT USING (
        auth.uid() = user1_id
        OR auth.uid() = user2_id
    );
CREATE POLICY "Users can insert conversations" ON conversations FOR
INSERT WITH CHECK (
        auth.uid() = user1_id
        OR auth.uid() = user2_id
    );
-- Chat messages: Users can only see and modify messages in their conversations
CREATE POLICY "Users can view messages in their conversations" ON chat_messages FOR
SELECT USING (
        sender_id = auth.uid()
        OR receiver_id = auth.uid()
    );
CREATE POLICY "Users can insert their own messages" ON chat_messages FOR
INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users can delete their own messages" ON chat_messages FOR DELETE USING (sender_id = auth.uid());
-- Blocked users: Users can manage their own blocks
CREATE POLICY "Users can view their blocks" ON blocked_users FOR
SELECT USING (blocker_id = auth.uid());
CREATE POLICY "Users can block others" ON blocked_users FOR
INSERT WITH CHECK (blocker_id = auth.uid());
-- User reports: Reports are private to the reporter
CREATE POLICY "Users can view their own reports" ON user_reports FOR
SELECT USING (reporter_id = auth.uid());
CREATE POLICY "Users can submit reports" ON user_reports FOR
INSERT WITH CHECK (reporter_id = auth.uid());