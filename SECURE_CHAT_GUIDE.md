# 🔐 Secure Chat System Implementation Guide

## Overview

This guide documents the security-hardened chat system with user isolation, authentication, and modern UI.

---

## 1. SECURITY ARCHITECTURE

### Authentication Flow

```
User Login → Supabase JWT → Socket.IO Auth → Room Access
```

**Key Security Features:**

- ✅ JWT token verification on socket connection
- ✅ User-isolated chat data (senderId/receiverId validation)
- ✅ Backend authorization middleware for all API routes
- ✅ Conversation ownership verification
- ✅ Message sender validation

### Database Security

**Row-Level Security (RLS) Enabled:**

- Users can only view their own conversations
- Users can only see messages they sent/received
- Users can only manage their own blocks and reports

---

## 2. BACKEND CHANGES

### Authentication Middleware

```javascript
const verifyJWT = async (token) => {
  // Verifies Supabase JWT token and returns authenticated user
  // Called on socket auth and API routes
};

const authenticateUser = async (req, res, next) => {
  // Express middleware for protected routes
  // Requires Authorization header with Bearer token
};
```

### Socket.IO Events (Secured)

**`auth`** - Authenticate socket connection

```javascript
socket.emit("auth", jwtToken);
// Response: auth_success { userId, email }
```

**`join_conversation`** - Join conversation room

```javascript
socket.emit("join_conversation", {
  conversationId: "conv-123",
  otherUserId: "user-456",
});
// Only room members can join
```

**`send_message`** - Send message (validated)

```javascript
socket.emit("send_message", {
  conversationId: "conv-123",
  senderId: "user-123", // Verified against logged-in user
  receiverId: "user-456",
  message: "Hello!",
  messageType: "text",
});
```

**`delete_message`** - Delete sender's message

```javascript
socket.emit("delete_message", {
  messageId: "msg-123",
  conversationId: "conv-123",
});
```

**`clear_conversation`** - Clear all messages

```javascript
socket.emit("clear_conversation", conversationId);
```

### REST API Endpoints (Protected)

**`GET /api/chat/conversations`**

- Fetch all user's conversations
- Requires: Bearer token in Authorization header
- Returns: Array of conversations with user details

**`GET /api/chat/conversation/:conversationId/messages`**

- Fetch messages for specific conversation
- Requires: Bearer token + conversation membership
- Returns: Message array (senderId, receiverId, message, timestamp)

**`POST /api/chat/block-user`**

- Block a user
- Body: `{ blockedUserId: "user-456" }`
- Returns: `{ success: true }`

**`POST /api/chat/report-user`**

- Report inappropriate behavior
- Body: `{ reportedUserId, reason, message }`
- Sends admin notification email
- Returns: `{ success: true }`

---

## 3. FRONTEND CHANGES (Chat.tsx)

### Component Props

```typescript
<Chat
  otherUserId="support-id" // User ID of recipient
  otherUserEmail="support@edufund.com" // Display name
/>
```

### Key Features

#### 1. Call Buttons (UI Only)

```jsx
<Phone /> - Audio call button
<Video /> - Video call button
// Can integrate Jitsi/Twilio later
```

#### 2. Three-Dot Menu

- **Clear Chat** - Delete all messages in conversation
- **Block User** - Add to blocked list
- **Report User** - Submit report with reason

#### 3. Message Options (Hover)

- **Copy** - Copy message text
- **Delete** - Delete sent message (own messages only)
- **Edit** - Placeholder for future edit feature

#### 4. Exit Confirmation

```javascript
// Triggers when user tries to:
// - Close tab (beforeunload)
// - Refresh page (beforeunload)
// - Navigate away (popstate)
// Shows: "Are you sure you want to exit the chat?"
```

#### 5. Message Animations

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fadeInUp {
  animation: fadeInUp 0.4s ease-out;
}
```

#### 6. UI Enhancements

- Modern emoji-enhanced header (💬)
- Responsive design (mobile + desktop)
- Rounded message bubbles
- Gradient background (blue-50 → indigo-50)
- Smooth hover effects on buttons
- Clean input with Paperclip icon

---

## 4. DATABASE SCHEMA

### conversations

```sql
id | user1_id | user2_id | created_at | updated_at
```

Unique constraint on (user1_id, user2_id)

### chat_messages

```sql
id | conversation_id | sender_id | receiver_id |
message_text | message_type | is_deleted | created_at
```

Indexed on: conversation_id, sender_id, receiver_id, created_at

### blocked_users

```sql
id | blocker_id | blocked_id | created_at
```

Unique constraint on (blocker_id, blocked_id)

### user_reports

```sql
id | reporter_id | reported_id | reason |
message | resolved | created_at
```

---

## 5. SETUP INSTRUCTIONS

### Step 1: Apply Database Migration

```sql
-- Run in Supabase SQL Editor:
-- Copy contents of supabase/migrations/007_add_chat_tables.sql
-- Execute query
```

### Step 2: Verify Environment Variables

```env
# .env file should have:
SUPABASE_URL=<your-project-url>
SUPABASE_ANON_KEY=<your-anon-key>
VITE_SOCKET_URL=<socket-server-url>
VITE_API_BASE_URL=<api-server-url>
```

### Step 3: Test Chat Connection

1. Open http://localhost:8081
2. Login with test account
3. Navigate to Chat page
4. Send message
5. Verify message appears and persists in database

### Step 4: (Optional) Integrate Call Features

- **Audio/Video:** Integrate Jitsi Meet or Twilio
- Example: `window.open('https://meet.jit.si/' + conversationId)`

---

## 6. SECURITY CHECKLIST

- ✅ JWT verification on socket auth
- ✅ Conversation membership verification
- ✅ Sender ID validation (no ID tampering)
- ✅ Message delete restricted to sender
- ✅ User-isolated data (RLS enabled)
- ✅ Rate limiting: Add in production
- ✅ File upload: Validate size/type before storing
- ✅ XSS prevention: React auto-escapes content

---

## 7. KNOWN LIMITATIONS & FUTURE ENHANCEMENTS

| Feature          | Status          | Notes                                     |
| ---------------- | --------------- | ----------------------------------------- |
| Audio/Video Call | UI Only         | Requires integration with Jitsi/Twilio    |
| Message Edit     | Stub            | Can extend delete_message to edit_message |
| File Sharing     | Placeholder     | Requires S3/Supabase Storage integration  |
| Typing Indicator | Not Implemented | Add socket event "user_typing"            |
| Read Receipts    | Not Implemented | Add is_read field to messages             |
| Message Search   | Not Implemented | Query chat_messages by text               |
| User Presence    | Not Implemented | Track online/offline status               |

---

## 8. TESTING SCENARIOS

### Scenario 1: User-Isolated Data

```
1. Login as User A
2. Send message to User B
3. Logout, login as User C
4. Try to fetch User A-B conversation
5. EXPECTED: 403 Unauthorized (User C not in conversation)
```

### Scenario 2: Message Persistence

```
1. User A sends message to User B
2. Refresh page
3. EXPECTED: Message loads from database
```

### Scenario 3: Block User

```
1. User A blocks User B
2. User B tries to message User A
3. EXPECTED: User B cannot send message (implement check)
```

### Scenario 4: Exit Confirmation

```
1. User has active chat
2. Close tab/refresh/navigate away
3. EXPECTED: Confirmation dialog appears
```

---

## 9. TROUBLESHOOTING

**Socket auth fails:**

- Check JWT token in Authorization header
- Verify Supabase session is valid
- Check browser console for "auth_error"

**Messages not loading:**

- Verify conversation membership
- Check database RLS policies
- Ensure user IDs match in conversation table

**Real-time updates not working:**

- Check socket connection status (browser DevTools → Network → WS)
- Verify room join completed before sending message
- Check server console for socket events

---

## 10. DEPLOYMENT NOTES

### Production HTTPS

- Automatic HTTPS upgrade via `getSocketUrl()` and `getApiUrl()`
- Works on Render, Vercel, etc.

### Environment Variables

```env
# Production (Render)
DATABASE_URL=<postgresql-url>
SUPABASE_URL=https://your-project.supabase.co
VITE_SOCKET_URL=https://your-api.onrender.com
VITE_API_BASE_URL=https://your-api.onrender.com
```

---

## Questions?

- Backend logic: Check `server/index.js` lines 115-240
- Frontend UI: Check `src/pages/Chat.tsx` entire file
- Database: Check `supabase/migrations/007_add_chat_tables.sql`
