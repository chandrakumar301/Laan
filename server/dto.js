// ===================== CHAT DTOs =====================

// Message DTO - returned from API
export class MessageDTO {
  constructor(data) {
    this.id = data.id;
    this.senderId = data.sender_id;
    this.receiverId = data.receiver_id;
    this.conversationId = data.conversation_id;
    this.message = data.message_text;
    this.messageType = data.message_type || "text";
    this.timestamp = data.created_at;
    this.isDeleted = data.is_deleted || false;
  }
}

// Conversation DTO
export class ConversationDTO {
  constructor(data) {
    this.id = data.id;
    this.user1Id = data.user1_id;
    this.user2Id = data.user2_id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }
}

// User Profile for Chat (admin view)
export class ChatUserDTO {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.avatar = data.avatar;
  }
}

// Conversation with User info (for admin listing)
export class ConversationWithUserDTO {
  constructor(conversationData, userData, lastMessage = null) {
    this.id = conversationData.id;
    this.user = {
      id: userData.id,
      email: userData.email,
      firstName: userData.first_name,
      lastName: userData.last_name,
      avatar: userData.avatar,
    };
    this.lastMessage = lastMessage ? new MessageDTO(lastMessage) : null;
    this.createdAt = conversationData.created_at;
    this.updatedAt = conversationData.updated_at;
  }
}

// Conversation Messages Response
export class ConversationMessagesDTO {
  constructor(conversationData, messages) {
    this.id = conversationData.id;
    this.otherUser = conversationData.otherUser;
    this.messages = messages.map((msg) => new MessageDTO(msg));
    this.createdAt = conversationData.created_at;
  }
}

// Admin Dashboard Stats
export class AdminChatStatsDTO {
  constructor(data) {
    this.totalConversations = data.totalConversations || 0;
    this.totalMessages = data.totalMessages || 0;
    this.unreadMessages = data.unreadMessages || 0;
    this.activeUsers = data.activeUsers || 0;
  }
}

// Message Create Request DTO (input validation)
export class MessageCreateDTO {
  constructor(data) {
    this.receiverId = data.receiverId;
    this.message = data.message;
    this.messageType = data.messageType || "text";
  }

  validate() {
    const errors = [];
    if (!this.receiverId) errors.push("Receiver ID is required");
    if (!this.message || this.message.trim() === "")
      errors.push("Message cannot be empty");
    if (!["text", "file"].includes(this.messageType))
      errors.push("Invalid message type");
    return errors;
  }
}

// Conversation List Item (compact for chat list)
export class ConversationListItemDTO {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.userName = data.userName;
    this.userEmail = data.userEmail;
    this.userAvatar = data.userAvatar;
    this.lastMessagePreview = data.lastMessagePreview;
    this.lastMessageTime = data.lastMessageTime;
    this.unreadCount = data.unreadCount || 0;
  }
}
