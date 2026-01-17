# Chat API Reference

## Base URL

```
http://localhost:4000
Production: https://your-domain.com
```

## Authentication

All endpoints (except GET /) require:

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## Endpoints

### 1. List All Users (Admin Only)

```
GET /chat/users
```

**Authorization**: Admin only (edufund0099@gmail.com)

**Response**: 200 OK

```json
{
  "users": [
    {
      "id": "uuid-1",
      "email": "john@example.com",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "uuid-2",
      "email": "jane@example.com",
      "created_at": "2024-01-14T09:20:00Z"
    }
  ]
}
```

**Errors**:

- `401`: Unauthorized (invalid token)
- `403`: Forbidden (not admin)
- `500`: Server error

---

### 2. Get Conversations

```
GET /chat/conversations
```

**Authorization**: Required (any authenticated user)

**Response**: 200 OK

```json
{
  "conversations": [
    {
      "id": "conv-uuid-1",
      "user_id": "uuid-1",
      "admin_id": "admin-uuid",
      "user_email": "john@example.com",
      "admin_email": "edufund0099@gmail.com",
      "last_message_at": "2024-01-20T15:45:00Z",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-20T15:45:00Z"
    }
  ]
}
```

**Admin vs User**:

- **Admin**: Sees ALL conversations
- **User**: Sees only their own conversation

**Errors**:

- `401`: Unauthorized

---

### 3. Create/Get Conversation

```
POST /chat/conversations
```

**Authorization**: Required

**Request Body**:

```json
{
  "userId": "uuid-of-user"
}
```

**Response**: 201 Created / 200 OK

```json
{
  "conversation": {
    "id": "conv-uuid-1",
    "user_id": "uuid-1",
    "admin_id": "admin-uuid",
    "user_email": "john@example.com",
    "admin_email": "edufund0099@gmail.com",
    "last_message_at": null,
    "created_at": "2024-01-20T16:00:00Z",
    "updated_at": "2024-01-20T16:00:00Z"
  }
}
```

**Behavior**:

- If conversation exists → returns it (200)
- If conversation doesn't exist → creates it (201)
- Always creates with admin (edufund0099@gmail.com)
- Prevents duplicate 1-to-1s (UNIQUE constraint)

**Errors**:

- `401`: Unauthorized
- `400`: Bad request (missing userId)
- `500`: Server error

---

### 4. Get Messages

```
GET /chat/messages/:conversationId
```

**Authorization**: Required (must be conversation participant)

**Response**: 200 OK

```json
{
  "messages": [
    {
      "id": "msg-uuid-1",
      "conversation_id": "conv-uuid-1",
      "sender_id": "uuid-1",
      "receiver_id": "admin-uuid",
      "message_text": "Hello admin!",
      "status": "delivered",
      "is_read": false,
      "read_at": null,
      "created_at": "2024-01-20T16:05:00Z"
    },
    {
      "id": "msg-uuid-2",
      "conversation_id": "conv-uuid-1",
      "sender_id": "admin-uuid",
      "receiver_id": "uuid-1",
      "message_text": "Hi there! How can I help?",
      "status": "read",
      "is_read": true,
      "read_at": "2024-01-20T16:06:30Z",
      "created_at": "2024-01-20T16:06:00Z"
    }
  ]
}
```

**Behavior**:

- Returns ALL messages in conversation (ordered by created_at)
- Automatically marks received messages as "delivered"
- Only accessible to conversation participants

**Errors**:

- `401`: Unauthorized
- `403`: Access denied (not in conversation)
- `404`: Conversation not found
- `500`: Server error

---

### 5. Send Message

```
POST /chat/messages
```

**Authorization**: Required

**Request Body**:

```json
{
  "conversationId": "conv-uuid-1",
  "receiverId": "admin-uuid",
  "messageText": "Hello! I need help with my loan"
}
```

**Response**: 201 Created

```json
{
  "message": {
    "id": "msg-uuid-3",
    "conversation_id": "conv-uuid-1",
    "sender_id": "uuid-1",
    "receiver_id": "admin-uuid",
    "message_text": "Hello! I need help with my loan",
    "status": "sent",
    "is_read": false,
    "read_at": null,
    "created_at": "2024-01-20T16:10:00Z"
  }
}
```

**Behavior**:

- Validates conversation exists
- Validates sender is participant
- Validates receiver is opposite party
- Creates message with status='sent'
- Updates conversation.last_message_at
- Broadcasts via Socket.IO to conversation room
- Notifies receiver via Socket.IO user room

**Errors**:

- `401`: Unauthorized
- `400`: Bad request (missing fields)
- `403`: Access denied (not in conversation)
- `404`: Conversation not found
- `500`: Server error

---

### 6. Mark Message as Read

```
PUT /chat/messages/:messageId/read
```

**Authorization**: Required (must be receiver)

**Response**: 200 OK

```json
{
  "message": {
    "id": "msg-uuid-2",
    "conversation_id": "conv-uuid-1",
    "sender_id": "admin-uuid",
    "receiver_id": "uuid-1",
    "message_text": "Hi there! How can I help?",
    "status": "read",
    "is_read": true,
    "read_at": "2024-01-20T16:20:30Z",
    "created_at": "2024-01-20T16:06:00Z"
  }
}
```

**Behavior**:

- Only receiver can mark as read
- Sets status='read'
- Sets is_read=true
- Sets read_at=NOW()
- Broadcasts via Socket.IO

**Errors**:

- `401`: Unauthorized
- `403`: Forbidden (not receiver)
- `404`: Message not found
- `500`: Server error

---

### 7. Get Chat Statistics (Admin Only)

```
GET /chat/stats
```

**Authorization**: Admin only

**Response**: 200 OK

```json
{
  "totalConversations": 42,
  "totalMessages": 587,
  "unreadMessages": 12
}
```

**Behavior**:

- Counts active conversations
- Counts total messages ever sent
- Counts messages still unread by admin

**Errors**:

- `401`: Unauthorized
- `403`: Forbidden (not admin)
- `500`: Server error

---

## Socket.IO Events

### Connection & Auth

#### Event: "auth"

**Direction**: Client → Server

**Payload**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:

- `auth_success` ← Server sends if valid
- Disconnects if invalid token

**Client Code**:

```javascript
socket.emit("auth", { token: sessionToken });
socket.on("auth_success", () => {
  console.log("Authenticated!");
});
```

---

### Conversation Management

#### Event: "join_conversation"

**Direction**: Client → Server

**Payload**:

```json
{
  "conversationId": "conv-uuid-1"
}
```

**Behavior**:

- Validates user is participant
- Joins Socket.IO room: `conversation:conversationId`
- Now receives real-time messages for this conversation

**Client Code**:

```javascript
socket.emit("join_conversation", { conversationId: "conv-uuid-1" });
```

---

### Messaging

#### Event: "message:send"

**Direction**: Client → Server

**Payload**:

```json
{
  "conversationId": "conv-uuid-1",
  "messageText": "Hello!"
}
```

**Behavior**:

- Saves message to DB
- Emits to `conversation:conversationId` room
- Notifies receiver via `user:receiverId` room

**Reception**:

- All clients in `conversation:conversationId` receive:

```json
{
  "type": "message:received",
  "message": {...}
}
```

**Client Code**:

```javascript
socket.emit("message:send", {
  conversationId: "conv-uuid-1",
  messageText: "Hello admin!",
});

socket.on("message:received", (data) => {
  console.log("New message:", data.message);
  setMessages((prev) => [...prev, data.message]);
});
```

---

#### Event: "message:read"

**Direction**: Client → Server

**Payload**:

```json
{
  "messageId": "msg-uuid-2",
  "conversationId": "conv-uuid-1"
}
```

**Behavior**:

- Updates message status='read' in DB
- Emits to conversation room (all participants get update)

**Client Code**:

```javascript
socket.emit("message:read", {
  messageId: "msg-uuid-2",
  conversationId: "conv-uuid-1",
});
```

---

### Typing Indicators

#### Event: "typing"

**Direction**: Client → Server

**Payload**:

```json
{
  "conversationId": "conv-uuid-1"
}
```

**Behavior**:

- Broadcasts to `conversation:conversationId` room (except sender)
- Other users in room receive:

```json
{
  "type": "user:typing",
  "userId": "uuid-1",
  "email": "john@example.com"
}
```

**Client Code**:

```javascript
socket.emit("typing", { conversationId: "conv-uuid-1" });
socket.on("user:typing", () => {
  setIsTyping(true);
  setTimeout(() => setIsTyping(false), 3000);
});
```

---

#### Event: "stop_typing"

**Direction**: Client → Server

**Payload**:

```json
{
  "conversationId": "conv-uuid-1"
}
```

**Behavior**:

- Broadcasts to conversation room (except sender)
- Others receive:

```json
{
  "type": "user:stop_typing",
  "userId": "uuid-1"
}
```

---

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Unauthorized"
}
```

**Cause**: Missing or invalid JWT token
**Fix**: Login again to get new token

---

### 403 Forbidden

```json
{
  "error": "Forbidden"
}
```

**Cause**: User lacks permission (e.g., non-admin accessing admin endpoint)
**Fix**: Use correct account or check user role

---

### 404 Not Found

```json
{
  "error": "Conversation not found"
}
```

**Cause**: Resource doesn't exist
**Fix**: Create it first or check ID

---

### 400 Bad Request

```json
{
  "error": "Message text is required"
}
```

**Cause**: Missing or invalid request fields
**Fix**: Check request payload format

---

### 500 Server Error

```json
{
  "error": "Server error"
}
```

**Cause**: Database or server issue
**Fix**: Check server logs, contact admin

---

## Rate Limiting

Currently: **No rate limiting**

**Recommended for production**:

- 100 messages per minute per user
- 50 conversations per minute per user
- 1000 API calls per hour per user

---

## Pagination (Future)

Not yet implemented. When added:

```
GET /chat/messages/:conversationId?limit=50&offset=0
```

---

## Batch Operations (Future)

Not yet implemented. When added:

```
POST /chat/messages/batch
Body: [message1, message2, ...]
```

---

## Webhooks (Future)

Not yet implemented. When added, will support:

```
POST /webhooks/chat/message_created
POST /webhooks/chat/message_read
POST /webhooks/chat/conversation_created
```

---

## Examples

### User Sends Message

```bash
curl -X POST http://localhost:4000/chat/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv-uuid-1",
    "receiverId": "admin-uuid",
    "messageText": "Hello!"
  }'
```

### Admin Gets All Conversations

```bash
curl http://localhost:4000/chat/conversations \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Mark Message as Read

```bash
curl -X PUT http://localhost:4000/chat/messages/msg-uuid-1/read \
  -H "Authorization: Bearer $TOKEN"
```

---

**Version**: 1.0.0  
**Last Updated**: Now  
**Status**: Production Ready ✅
