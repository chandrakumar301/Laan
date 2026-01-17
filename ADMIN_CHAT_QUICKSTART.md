# Quick Start: Admin Communication System

## 1. Update Supabase Schema

Run the migration to add new columns:

```sql
-- ALTER chat_messages to add is_read
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- ALTER users to add role
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON chat_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

## 2. Set Admin User in Database

Update a user to be admin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'edufund0099@gmail.com';
```

Or verify the admin exists:

```sql
SELECT id, email, role FROM users WHERE role = 'admin' LIMIT 1;
```

## 3. Add Routes to App

In your main routing file (e.g., `App.tsx` or router config):

```tsx
import AdminChat from '@/pages/AdminChat';
import Chat from '@/pages/Chat';

// Add these routes:
<Route path="/chat" element={<Chat />} />
<Route path="/admin/chat" element={<AdminChat />} />
```

## 4. Update NavBar/Menu

Add links to chat pages:

```tsx
// For regular users
<NavLink to="/chat">Support Chat</NavLink>

// For admins
<NavLink to="/admin/chat">Admin Messages</NavLink>
```

## 5. Optional: Environment Variables

Add to `.env`:

```
VITE_ADMIN_EMAIL=edufund0099@gmail.com
```

## 6. Test the System

### As Regular User:

1. Login as regular user
2. Go to `/chat`
3. Type message and send
4. Should see admin in the sidebar

### As Admin:

1. Login as admin user
2. Go to `/admin/chat`
3. Should see list of all users
4. Click user to open their messages
5. Send response
6. Both sides should update in real-time

## API Endpoints Reference

### Admin Only Endpoints:

**List all conversations**

```
GET /api/admin/conversations
Authorization: Bearer <token>
```

**Get messages with user**

```
GET /api/admin/conversations/:userId/messages
Authorization: Bearer <token>
```

**Send message to user**

```
POST /api/admin/conversations/:userId/message
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Help text here"
}
```

**Get chat statistics**

```
GET /api/admin/chat-stats
Authorization: Bearer <token>
```

## Key Features Implemented

✅ **Admin Dashboard**

- See all users in conversation list
- Search users by name/email
- View complete message history
- Send messages with real-time updates

✅ **User Chat**

- Simple interface to chat with admin
- Auto-connects to admin
- Real-time message delivery
- Status indicator (connecting/connected/error)

✅ **Database**

- Message read status tracking
- User role assignment
- Conversation history

✅ **Backend DTOs**

- Type-safe data transfers
- Validation
- Consistent API responses

## Troubleshooting

### Issue: "Admin access required" error

**Solution**: Make sure the user's role is set to 'admin' in the database:

```sql
SELECT email, role FROM users WHERE email = 'your-admin-email@gmail.com';
```

### Issue: Messages not appearing in real-time

**Solution**: Check socket.io connection:

1. Open browser DevTools
2. Go to Network tab
3. Filter by "WS" (WebSocket)
4. Should see socket.io connection active

### Issue: "No admin found"

**Solution**: The system tries to find admin by:

1. Looking for user with `role = 'admin'`
2. Fallback: Looks for email matching `VITE_ADMIN_EMAIL`
3. Make sure at least one of these exists

## Data Flow

```
User sends message
      ↓
Socket.io emit "send_message"
      ↓
Backend stores in DB
      ↓
Admin receives via socket "receive_message"
      ↓
Admin chat UI updates
      ↓
Admin sends reply
      ↓
Socket.io emit to user
      ↓
User receives message
```

## File Structure

```
server/
├── dto.js                    # Data Transfer Objects
├── index.js                  # Backend with admin endpoints

src/pages/
├── Chat.tsx                  # User-to-admin chat
└── AdminChat.tsx            # Admin message dashboard

supabase/migrations/
└── 008_add_admin_chat_features.sql  # DB schema updates
```
