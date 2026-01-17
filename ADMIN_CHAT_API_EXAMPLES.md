# Admin Chat API Examples

## Base URL

```
http://localhost:4000
```

## Authentication

All requests require Bearer token in Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### 1. Get All Conversations (Admin Only)

**Request:**

```bash
curl -X GET http://localhost:4000/api/admin/conversations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "conversations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "avatar": null
      },
      "lastMessage": {
        "text": "Can I get help with my loan?",
        "timestamp": "2024-01-16T10:30:00Z",
        "isSent": false
      },
      "createdAt": "2024-01-15T08:00:00Z",
      "updatedAt": "2024-01-16T10:30:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "user": {
        "id": "223e4567-e89b-12d3-a456-426614174001",
        "email": "jane@example.com",
        "first_name": "Jane",
        "last_name": "Smith",
        "avatar": null
      },
      "lastMessage": {
        "text": "Thank you for your help!",
        "timestamp": "2024-01-16T09:15:00Z",
        "isSent": true
      },
      "createdAt": "2024-01-14T12:00:00Z",
      "updatedAt": "2024-01-16T09:15:00Z"
    }
  ]
}
```

---

### 2. Get Messages with Specific User (Admin Only)

**Request:**

```bash
curl -X GET http://localhost:4000/api/admin/conversations/123e4567-e89b-12d3-a456-426614174000/messages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "avatar": null
  },
  "messages": [
    {
      "id": "msg-1",
      "sender_id": "123e4567-e89b-12d3-a456-426614174000",
      "receiver_id": "admin-id-here",
      "message_text": "Hi, I need help with my loan application",
      "message_type": "text",
      "is_deleted": false,
      "created_at": "2024-01-16T10:00:00Z"
    },
    {
      "id": "msg-2",
      "sender_id": "admin-id-here",
      "receiver_id": "123e4567-e89b-12d3-a456-426614174000",
      "message_text": "Sure! I can help. What's your concern?",
      "message_type": "text",
      "is_deleted": false,
      "created_at": "2024-01-16T10:05:00Z"
    },
    {
      "id": "msg-3",
      "sender_id": "123e4567-e89b-12d3-a456-426614174000",
      "receiver_id": "admin-id-here",
      "message_text": "I want to know about the approval process",
      "message_type": "text",
      "is_deleted": false,
      "created_at": "2024-01-16T10:30:00Z"
    }
  ]
}
```

---

### 3. Send Message to User (Admin Only)

**Request:**

```bash
curl -X POST http://localhost:4000/api/admin/conversations/123e4567-e89b-12d3-a456-426614174000/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Your loan has been approved! Congratulations!"
  }'
```

**Response:**

```json
{
  "message": {
    "id": "msg-4",
    "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
    "sender_id": "admin-id-here",
    "receiver_id": "123e4567-e89b-12d3-a456-426614174000",
    "message_text": "Your loan has been approved! Congratulations!",
    "message_type": "text",
    "is_deleted": false,
    "created_at": "2024-01-16T10:35:00Z"
  }
}
```

---

### 4. Get Chat Statistics (Admin Only)

**Request:**

```bash
curl -X GET http://localhost:4000/api/admin/chat-stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "totalConversations": 12,
  "totalMessages": 156,
  "unreadMessages": 3
}
```

---

## Error Responses

### 401 - Unauthorized

```json
{
  "error": "Unauthorized"
}
```

**Cause**: Missing or invalid token

### 403 - Forbidden

```json
{
  "error": "Admin access required"
}
```

**Cause**: User is not an admin

### 404 - Not Found

```json
{
  "error": "Conversation not found"
}
```

**Cause**: Specified conversation/user doesn't exist

### 400 - Bad Request

```json
{
  "error": "Message cannot be empty"
}
```

**Cause**: Invalid request body

### 500 - Server Error

```json
{
  "error": "Server error"
}
```

**Cause**: Unexpected server error

---

## Socket.IO Events

### From Client

**authenticate**

```javascript
socket.emit("auth", token);
```

**Join Conversation**

```javascript
socket.emit("join_conversation", {
  conversationId: "conv-id",
  otherUserId: "user-id",
});
```

**Send Message**

```javascript
socket.emit("send_message", {
  conversationId: "conv-id",
  message: "Hello!",
  messageType: "text",
});
```

---

### From Server

**Authentication Success**

```javascript
socket.on("auth_success", (data) => {
  console.log(data); // { userId, email }
});
```

**Message History**

```javascript
socket.on("message_history", (messages) => {
  console.log(messages); // Array of messages
});
```

**Receive Message**

```javascript
socket.on("receive_message", (msg) => {
  console.log(msg); // { id, senderId, receiverId, message, timestamp }
});
```

**Error Event**

```javascript
socket.on("error", (error) => {
  console.error(error); // { error: 'error message' }
});
```

---

## Example Integration

### Get Token (Frontend)

```typescript
const {
  data: { session },
} = await supabase.auth.getSession();
const token = session?.access_token;
```

### Fetch Conversations (React)

```typescript
const fetchConversations = async () => {
  const response = await fetch(
    "http://localhost:4000/api/admin/conversations",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const data = await response.json();
  return data.conversations;
};
```

### Send Message (Socket.IO)

```typescript
socket.emit("send_message", {
  conversationId: conversationId,
  message: "My response here",
  messageType: "text",
});
```

---

## Testing with Postman

1. **Get your JWT token** from Supabase (sign in)
2. **Set up Postman**:

   - Create collection "EduFund Admin Chat"
   - Add variable: `token` = your_jwt_token
   - Add variable: `baseUrl` = http://localhost:4000
   - Add variable: `userId` = user_id_to_message

3. **Create requests**:

   ```
   GET {{baseUrl}}/api/admin/conversations
   Authorization: Bearer {{token}}
   ```

   ```
   GET {{baseUrl}}/api/admin/conversations/{{userId}}/messages
   Authorization: Bearer {{token}}
   ```

   ```
   POST {{baseUrl}}/api/admin/conversations/{{userId}}/message
   Authorization: Bearer {{token}}
   Content-Type: application/json

   {
     "message": "Your message here"
   }
   ```

   ```
   GET {{baseUrl}}/api/admin/chat-stats
   Authorization: Bearer {{token}}
   ```

---

## Common Issues & Solutions

### Issue: "Admin access required"

**Solution**: Ensure the token belongs to a user with `role = 'admin'`

### Issue: "Conversation not found"

**Solution**: Make sure the user ID exists and they have communicated with the admin

### Issue: Message not appearing in real-time

**Solution**: Check that Socket.IO is connected (`socket.connected === true`)

### Issue: CORS error

**Solution**: Check that backend CORS is configured for your frontend URL
