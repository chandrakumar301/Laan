/**
 * ============================================
 * CHAT SYSTEM - BACKEND APIS
 * ============================================
 * Secure endpoints with data isolation
 */

import {
  requireAdmin,
  requireAuth,
  canAccessConversation,
  canSendMessage,
  isAdmin,
} from "./chat-auth.js";

/**
 * Register chat routes
 * @param {Express} app - Express app
 * @param {Supabase} supabase - Supabase client
 * @param {SocketIO} io - Socket.IO server
 */
export function registerChatRoutes(app, supabase, io) {
  /**
   * API: GET /chat/users
   * Admin only: Get all users
   */
  app.get("/chat/users", requireAdmin(supabase), async (req, res) => {
    try {
      console.log("[USERS] Fetching users for admin");

      // Try public.users table first
      let { data: users, error } = await supabase
        .from("users")
        .select("id, email, created_at")
        .neq("email", "edufund0099@gmail.com")
        .order("created_at", { ascending: false });

      // If table doesn't exist, use auth.users via admin API
      if (error) {
        console.warn(
          `[USERS] Query error: ${error.message} (code: ${error.code})`,
        );
        console.warn("[USERS] Falling back to auth admin API...");

        try {
          const { data, error: authError } =
            await supabase.auth.admin.listUsers();

          if (authError) {
            console.error("[USERS] Auth API error:", authError.message);
            // Return empty list instead of error - at least admin can see interface
            return res.json({ ok: true, users: [], count: 0 });
          }

          console.log(
            `[USERS] Auth API returned ${data?.users?.length || 0} users`,
          );

          if (!data?.users || data.users.length === 0) {
            console.log("[USERS] No users in system yet");
            return res.json({ ok: true, users: [], count: 0 });
          }

          users = data.users
            .filter((u) => u.email !== "edufund0099@gmail.com")
            .map((u) => ({
              id: u.id,
              email: u.email,
              created_at: u.created_at || new Date().toISOString(),
            }))
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
            );

          console.log(
            `[USERS] Filtered to ${users?.length || 0} users (excluding admin)`,
          );
        } catch (fallbackErr) {
          console.error(
            "[USERS] Auth API fallback error:",
            fallbackErr.message,
          );
          // Return empty list - better than error
          return res.json({ ok: true, users: [], count: 0 });
        }
      } else {
        console.log(
          `[USERS] Got ${users?.length || 0} users from public.users table`,
        );
      }

      res.json({
        ok: true,
        users: users || [],
        count: users?.length || 0,
      });
    } catch (err) {
      console.error("[USERS] Exception:", err.message);
      // Return empty list on any error
      res.json({ ok: true, users: [], count: 0 });
    }
  });

  /**
   * API: POST /chat/sync-user
   * Sync current user to public users table (called on first login)
   */
  app.post("/chat/sync-user", async (req, res) => {
    try {
      // Extract token manually to avoid middleware issues
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");

      if (!token) {
        console.log("[SYNC] No token provided - skipping");
        return res.json({ ok: true, message: "No token - sync skipped" });
      }

      // Verify token and extract user info
      const user = await verifyAuth(token, supabase);
      if (!user || !user.userId) {
        console.log("[SYNC] Token verification failed - skipping");
        return res.json({ ok: true, message: "Invalid token - sync skipped" });
      }

      const { userId, email } = user;

      if (!userId || !email) {
        console.warn("[SYNC] Missing userId or email", { userId, email });
        return res.json({ ok: true, message: "Sync skipped - missing data" });
      }

      console.log(`[SYNC] Syncing user: ${email}`);

      // Try to upsert user to public users table
      const { error } = await supabase
        .from("users")
        .upsert({ id: userId, email: email }, { onConflict: "id" });

      // If any error occurs (table missing, permissions, etc), just log and continue
      if (error) {
        console.warn(`[SYNC] Upsert error (non-critical): ${error.message}`);
        return res.json({
          ok: true,
          message: "User sync skipped - table not available",
        });
      }

      console.log(`[SYNC] User synced successfully: ${email}`);
      res.json({ ok: true, message: "User synced" });
    } catch (err) {
      console.warn("[SYNC] Exception (non-critical):", err.message);
      // Always return success - sync is non-critical
      res.json({ ok: true, message: "Sync completed" });
    }
  });

  /**
   * API: GET /chat/conversations
   * Get user's conversations
   * - Admin sees all conversations
   * - User sees only their own
   */
  app.get("/chat/conversations", requireAuth(supabase), async (req, res) => {
    try {
      const { userId, isAdmin: userIsAdmin } = req.user;

      if (!userId) {
        return res.status(400).json({ error: "Invalid user ID in token" });
      }

      let query = supabase
        .from("conversations")
        .select(
          "id, user_id, admin_id, user_email, admin_email, created_at, updated_at, last_message_at",
        );

      // Filter by user if not admin
      if (!userIsAdmin) {
        query = query.eq("user_id", userId);
      }

      const { data: conversations, error } = await query.order(
        "last_message_at",
        { ascending: false, nullsFirst: false },
      );

      if (error) {
        console.error("Conversations query error:", error);
        return res.status(500).json({
          error: "Failed to fetch conversations",
          details: error.message,
        });
      }

      // For each conversation, get unread count and last message
      const enriched = await Promise.all(
        (conversations || []).map(async (conv) => {
          // Get unread count
          const { count: unreadCount } = await supabase
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .eq("receiver_id", userId)
            .eq("is_read", false);

          // Get last message preview
          const { data: lastMsg } = await supabase
            .from("chat_messages")
            .select("message_text, sender_id, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          return {
            ...conv,
            unreadCount: unreadCount || 0,
            lastMessage: lastMsg?.message_text || "",
            lastMessageTime: lastMsg?.created_at,
            lastMessageIsFromMe: lastMsg?.sender_id === userId,
          };
        }),
      );

      res.json({
        ok: true,
        conversations: enriched,
      });
    } catch (err) {
      console.error("Get conversations error:", err);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  /**
   * API: POST /chat/conversations
   * Create new conversation (user-admin only)
   */
  app.post("/chat/conversations", requireAuth(supabase), async (req, res) => {
    try {
      const { userId: currentUserId, email: currentUserEmail } = req.user;
      const { userId: targetUserId } = req.body;

      // If targetUserId is provided, user is selecting someone to chat with (admin case)
      // If not provided, user is initiating conversation with admin (regular user case)
      const selectedUserId = targetUserId || null;
      const adminEmail = "edufund0099@gmail.com";

      if (selectedUserId && selectedUserId === currentUserId) {
        return res.status(400).json({ error: "Cannot chat with yourself" });
      }

      // Get all users to find admin and selected user info
      const { data: allUsers, error: usersError } =
        await supabase.auth.admin.listUsers();

      if (usersError || !allUsers?.users) {
        return res.status(500).json({ error: "Failed to get user info" });
      }

      const adminUser = allUsers.users.find((u) => u.email === adminEmail);
      if (!adminUser) {
        return res.status(404).json({ error: "Admin not found" });
      }

      let finalUserId, finalUserEmail, finalAdminId, finalAdminEmail;

      if (selectedUserId) {
        // Admin is selecting a user to chat with
        const selectedUser = allUsers.users.find(
          (u) => u.id === selectedUserId,
        );
        if (!selectedUser) {
          return res.status(404).json({ error: "Selected user not found" });
        }
        finalUserId = selectedUserId;
        finalUserEmail = selectedUser.email;
        finalAdminId = currentUserId;
        finalAdminEmail = currentUserEmail;
      } else {
        // Regular user is initiating conversation with admin
        finalUserId = currentUserId;
        finalUserEmail = currentUserEmail;
        finalAdminId = adminUser.id;
        finalAdminEmail = adminEmail;
      }

      // Create or get conversation
      const { data: conversation, error } = await supabase
        .from("conversations")
        .upsert(
          {
            user_id: finalUserId,
            admin_id: finalAdminId,
            user_email: finalUserEmail,
            admin_email: finalAdminEmail,
          },
          { onConflict: "user_id,admin_id" },
        )
        .select()
        .single();

      if (error) {
        console.error("[CONV] Upsert error:", error.message);
        return res.status(500).json({ error: "Failed to create conversation" });
      }

      console.log(
        `[CONV] Created conversation between ${finalAdminEmail} and ${finalUserEmail}`,
      );
      res.json({ ok: true, conversation });
    } catch (err) {
      console.error("[CONV] Exception:", err.message);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  /**
   * API: GET /chat/messages/:conversationId
   * Get messages in conversation with strict access control
   */
  app.get(
    "/chat/messages/:conversationId",
    requireAuth(supabase),
    async (req, res) => {
      try {
        const { conversationId } = req.params;
        const { userId } = req.user;

        // Verify access to conversation
        const hasAccess = await canAccessConversation(
          userId,
          conversationId,
          supabase,
        );

        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied" });
        }

        // Fetch messages with strict filtering
        const { data: messages, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        if (error) {
          return res.status(500).json({ error: "Failed to fetch messages" });
        }

        // Mark as delivered
        await supabase
          .from("chat_messages")
          .update({ status: "delivered" })
          .eq("conversation_id", conversationId)
          .eq("receiver_id", userId)
          .eq("status", "sent");

        res.json({
          ok: true,
          messages: messages || [],
        });
      } catch (err) {
        console.error("Get messages error:", err);
        res.status(500).json({ error: "Failed to fetch messages" });
      }
    },
  );

  /**
   * API: POST /chat/messages
   * Send message with sender/receiver validation
   */
  app.post("/chat/messages", requireAuth(supabase), async (req, res) => {
    try {
      const { userId: senderId } = req.user;
      const { conversationId, receiverId, message } = req.body;

      if (!message || !conversationId || !receiverId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify sender can send in this conversation
      const canSend = await canSendMessage(
        senderId,
        receiverId,
        conversationId,
        supabase,
      );

      if (!canSend) {
        return res.status(403).json({ error: "Cannot send message" });
      }

      // Create message
      const { data: messageData, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          receiver_id: receiverId,
          message_text: message,
          status: "sent",
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: "Failed to send message" });
      }

      // Update conversation last_message_at
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);

      // Emit via Socket.IO
      io.to(`conversation:${conversationId}`).emit("message:new", messageData);

      res.json({
        ok: true,
        message: messageData,
      });
    } catch (err) {
      console.error("Send message error:", err);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  /**
   * API: PUT /chat/messages/:messageId/read
   * Mark message as read
   */
  app.put(
    "/chat/messages/:messageId/read",
    requireAuth(supabase),
    async (req, res) => {
      try {
        const { messageId } = req.params;
        const { userId } = req.user;

        // Get message to verify ownership
        const { data: message, error: fetchError } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("id", messageId)
          .single();

        if (fetchError || !message) {
          return res.status(404).json({ error: "Message not found" });
        }

        // Only receiver can mark as read
        if (message.receiver_id !== userId) {
          return res.status(403).json({ error: "Cannot mark as read" });
        }

        // Update message
        const { data: updated, error } = await supabase
          .from("chat_messages")
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
            status: "read",
          })
          .eq("id", messageId)
          .select()
          .single();

        if (error) {
          return res.status(500).json({ error: "Failed to update message" });
        }

        // Emit via Socket.IO
        io.to(`conversation:${message.conversation_id}`).emit(
          "message:read",
          updated,
        );

        res.json({ ok: true, message: updated });
      } catch (err) {
        console.error("Mark as read error:", err);
        res.status(500).json({ error: "Failed to update message" });
      }
    },
  );

  /**
   * API: GET /chat/stats
   * Admin only: Get chat statistics
   */
  app.get("/chat/stats", requireAdmin(supabase), async (req, res) => {
    try {
      const { count: totalConversations } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true });

      const { count: totalMessages } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true });

      const { count: unreadMessages } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);

      res.json({
        ok: true,
        stats: {
          totalConversations: totalConversations || 0,
          totalMessages: totalMessages || 0,
          unreadMessages: unreadMessages || 0,
        },
      });
    } catch (err) {
      console.error("Get stats error:", err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
}
