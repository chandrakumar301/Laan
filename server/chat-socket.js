/**
 * ============================================
 * CHAT SYSTEM - SOCKET.IO INTEGRATION
 * ============================================
 * Real-time messaging with access control
 */

import { verifyAuth, canAccessConversation } from "./chat-auth.js";

/**
 * Initialize Socket.IO chat handlers
 * @param {SocketIO} io - Socket.IO server
 * @param {Supabase} supabase - Supabase client
 */
export function initChatSocket(io, supabase) {
  io.on("connection", async (socket) => {
    console.log("User connected:", socket.id);

    let user = null;

    /**
     * SOCKET: auth
     * Authenticate user with JWT token
     */
    socket.on("auth", async (token) => {
      user = await verifyAuth(token, supabase);

      if (!user) {
        socket.emit("auth_error", { error: "Invalid token" });
        socket.disconnect();
        return;
      }

      console.log("User authenticated:", user.email);
      socket.emit("auth_success", { userId: user.userId });

      // Join user room for targeted messages
      socket.join(`user:${user.userId}`);
    });

    /**
     * SOCKET: join_conversation
     * Join a conversation room
     */
    socket.on("join_conversation", async (data) => {
      if (!user) {
        socket.emit("error", { error: "Not authenticated" });
        return;
      }

      const { conversationId } = data;

      // Verify access
      const hasAccess = await canAccessConversation(
        user.userId,
        conversationId,
        supabase
      );

      if (!hasAccess) {
        socket.emit("error", { error: "Access denied" });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      console.log(`User ${user.email} joined conversation ${conversationId}`);

      // Emit that user is typing
      socket.broadcast
        .to(`conversation:${conversationId}`)
        .emit("user:typing", { userId: user.userId, email: user.email });
    });

    /**
     * SOCKET: message:send
     * Send message in real-time
     */
    socket.on("message:send", async (data) => {
      if (!user) {
        socket.emit("error", { error: "Not authenticated" });
        return;
      }

      const { conversationId, receiverId, message } = data;

      // Verify access
      const hasAccess = await canAccessConversation(
        user.userId,
        conversationId,
        supabase
      );

      if (!hasAccess) {
        socket.emit("error", { error: "Access denied" });
        return;
      }

      try {
        // Save to database
        const { data: messageData, error } = await supabase
          .from("chat_messages")
          .insert({
            conversation_id: conversationId,
            sender_id: user.userId,
            receiver_id: receiverId,
            message_text: message,
            status: "sent",
          })
          .select()
          .single();

        if (error) {
          socket.emit("error", { error: "Failed to send message" });
          return;
        }

        // Emit to conversation room
        io.to(`conversation:${conversationId}`).emit(
          "message:new",
          messageData
        );

        // Emit to receiver's user room for notifications
        io.to(`user:${receiverId}`).emit("message:notification", {
          conversationId,
          senderEmail: user.email,
          preview: message.substring(0, 50),
        });

        console.log(`Message sent in ${conversationId}`);
      } catch (err) {
        console.error("Socket send message error:", err);
        socket.emit("error", { error: "Failed to send message" });
      }
    });

    /**
     * SOCKET: message:read
     * Mark message as read
     */
    socket.on("message:read", async (data) => {
      if (!user) {
        socket.emit("error", { error: "Not authenticated" });
        return;
      }

      const { messageId, conversationId } = data;

      try {
        const { data: updated, error } = await supabase
          .from("chat_messages")
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
            status: "read",
          })
          .eq("id", messageId)
          .eq("receiver_id", user.userId)
          .select()
          .single();

        if (error || !updated) {
          return;
        }

        // Emit to conversation
        io.to(`conversation:${conversationId}`).emit("message:read", updated);
      } catch (err) {
        console.error("Socket mark read error:", err);
      }
    });

    /**
     * SOCKET: typing
     * User is typing indicator
     */
    socket.on("typing", (data) => {
      if (!user) return;

      const { conversationId } = data;
      socket.broadcast
        .to(`conversation:${conversationId}`)
        .emit("user:typing", {
          userId: user.userId,
          email: user.email,
        });
    });

    /**
     * SOCKET: stop_typing
     * User stopped typing
     */
    socket.on("stop_typing", (data) => {
      if (!user) return;

      const { conversationId } = data;
      socket.broadcast
        .to(`conversation:${conversationId}`)
        .emit("user:stop_typing", {
          userId: user.userId,
        });
    });

    /**
     * SOCKET: disconnect
     */
    socket.on("disconnect", () => {
      if (user) {
        console.log(`User disconnected: ${user.email}`);
      }
    });
  });
}
