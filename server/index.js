import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { registerChatRoutes } from "./chat-routes.js";
import { initChatSocket } from "./chat-socket.js";

dotenv.config();

/* =========================
   EXPRESS APP
========================= */

const app = express();
app.use(
  cors({
    origin: "*",
    credentials: false,
    exposedHeaders: ["x-rtb-fingerprint-id", "x-request-id", "x-custom-header"],
  }),
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Security headers middleware
app.use((req, res, next) => {
  // Permissions Policy - explicitly disallow sensor features
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), gyroscope=(), magnetometer=(), camera=(), microphone=()",
  );

  // CORS headers - expose custom headers
  res.setHeader(
    "Access-Control-Expose-Headers",
    "x-rtb-fingerprint-id, x-request-id, x-custom-header, content-type",
  );

  next();
});

/* =========================
   HTTP + SOCKET SERVER
========================= */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/* =========================
   RAZORPAY INSTANCE
========================= */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* =========================
   SUPABASE - INITIALIZE FIRST
========================= */

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

/* =========================
   SYNC USERS TO PUBLIC TABLE
========================= */

async function syncUsersToPublic() {
  try {
    console.log("🔄 Syncing users from auth to public users table...");

    // Get all auth users using admin API
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers();

    if (error) {
      console.warn("⚠️ Failed to list users:", error.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log("✅ No users to sync");
      return;
    }

    // Sync each user to public users table
    const syncPromises = users.map(async (user) => {
      try {
        const { error: upsertError } = await supabase
          .from("users")
          .upsert({ id: user.id, email: user.email }, { onConflict: "id" });

        if (upsertError) {
          console.warn(
            `⚠️ Failed to sync user ${user.email}:`,
            upsertError.message,
          );
        }
      } catch (err) {
        console.warn(`⚠️ Sync error for ${user.email}:`, err.message);
      }
    });

    await Promise.all(syncPromises);
    console.log(`✅ Synced ${users.length} users to public users table`);
  } catch (err) {
    console.warn("⚠️ User sync error:", err.message);
  }
}

// Sync users on startup (with small delay to ensure tables are ready)
setTimeout(() => {
  syncUsersToPublic();
}, 2000);

/* =========================
   MESSAGE HISTORY STORAGE
========================= */

const messageHistory = {};
const conversations = new Map(); // conversation_id -> { user1_id, user2_id, created_at, messages }
let databaseReady = false;

// Check if database is ready for use
async function isDatabaseReady() {
  if (databaseReady) return true;

  try {
    const { error } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error?.code === "PGRST205") {
      // Tables don't exist
      console.warn(
        "⚠️ Chat tables not found in database. Using in-memory storage (data will be lost on restart)",
      );
      return false;
    }

    databaseReady = true;
    console.log("✅ Database is ready for chat");
    return true;
  } catch (err) {
    console.warn("Database check failed:", err.message);
    return false;
  }
}

// Check database status on startup
isDatabaseReady();

/* =========================
   JWT VERIFICATION MIDDLEWARE
========================= */

// Verify Supabase JWT token
const verifyJWT = async (token) => {
  try {
    if (!token || !token.startsWith("Bearer ")) {
      return null;
    }
    const sessionToken = token.replace("Bearer ", "");

    // Decode JWT (without verification for now - in production use JWT library)
    // JWT format: header.payload.signature
    const parts = sessionToken.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    // Return user object from token
    return {
      id: payload.sub,
      email: payload.email,
      aud: payload.aud,
    };
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
};

// Express middleware for protected routes
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const user = await verifyJWT(authHeader);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = user;
  next();
};

/* =========================
   CHAT DATABASE OPERATIONS
========================= */

// Fetch messages for a conversation (user-isolated)
const getConversationMessages = async (userId, conversationId) => {
  try {
    const dbReady = await isDatabaseReady();

    if (!dbReady) {
      // Use in-memory storage
      const conv = conversations.get(conversationId);
      return conv?.messages || [];
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: true });

    if (error) {
      if (error.code === "PGRST205") {
        // Tables don't exist, use in-memory
        const conv = conversations.get(conversationId);
        return conv?.messages || [];
      }
      console.error("Error fetching messages:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Exception in getConversationMessages:", err);
    // Fallback to in-memory
    const conv = conversations.get(conversationId);
    return conv?.messages || [];
  }
};

// Get or create conversation
const getOrCreateConversation = async (user1Id, user2Id) => {
  try {
    // Check if conversation exists
    const { data: existing, error: fetchError } = await supabase
      .from("conversations")
      .select("*")
      .or(
        `and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`,
      )
      .limit(1)
      .single();

    if (!fetchError && existing) {
      return existing;
    }

    // Create new conversation
    const { data: newConv, error: createError } = await supabase
      .from("conversations")
      .insert([
        {
          user1_id: user1Id,
          user2_id: user2Id,
          created_at: new Date(),
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error("Error creating conversation:", createError);
      return null;
    }
    return newConv;
  } catch (err) {
    console.error("Exception in getOrCreateConversation:", err);
    return null;
  }
};

/* =========================
   SOCKET.IO CHAT WITH AUTH
========================= */

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  let currentUser = null;
  let activeConversations = new Set();

  // Authenticate socket connection
  socket.on("auth", async (token) => {
    const user = await verifyJWT(`Bearer ${token}`);
    if (!user) {
      socket.emit("auth_error", { error: "Invalid token" });
      socket.disconnect();
      return;
    }
    currentUser = user;
    socket.emit("auth_success", { userId: user.id, email: user.email });
    console.log(`✅ User authenticated: ${user.email}`);
  });

  // Join conversation room (user-isolated)
  socket.on("join_conversation", async ({ conversationId, otherUserId }) => {
    if (!currentUser) {
      socket.emit("error", { error: "Not authenticated" });
      return;
    }

    const dbReady = await isDatabaseReady();

    // Verify user is part of this conversation
    if (dbReady) {
      const { data: conv, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
        .single();

      if (error || !conv) {
        socket.emit("error", { error: "Unauthorized access to conversation" });
        return;
      }
    } else {
      // Check in-memory storage
      const conv = conversations.get(conversationId);
      if (
        !conv ||
        (conv.user1_id !== currentUser.id && conv.user2_id !== currentUser.id)
      ) {
        socket.emit("error", { error: "Unauthorized access to conversation" });
        return;
      }
    }

    const room = `conversation_${conversationId}`;
    socket.join(room);
    activeConversations.add(conversationId);

    // Fetch and send message history
    const messages = await getConversationMessages(
      currentUser.id,
      conversationId,
    );
    socket.emit("message_history", messages);

    console.log(
      `👤 ${currentUser.email} joined conversation ${conversationId}`,
    );
  });

  // Send message with user isolation
  socket.on("send_message", async (data) => {
    if (!currentUser) {
      socket.emit("error", { error: "Not authenticated" });
      return;
    }

    const { conversationId, receiverId, message, messageType } = data;

    // Verify sender is the authenticated user
    if (data.senderId !== currentUser.id) {
      socket.emit("error", { error: "Sender mismatch" });
      return;
    }

    const dbReady = await isDatabaseReady();

    // Verify conversation ownership
    if (dbReady) {
      const { data: conv, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
        .single();

      if (error || !conv) {
        socket.emit("error", { error: "Invalid conversation" });
        return;
      }
    } else {
      // Check in-memory storage
      const conv = conversations.get(conversationId);
      if (
        !conv ||
        (conv.user1_id !== currentUser.id && conv.user2_id !== currentUser.id)
      ) {
        socket.emit("error", { error: "Invalid conversation" });
        return;
      }
    }

    // Store message in database or in-memory
    const storedMsg = await storeMessage(
      currentUser.id,
      receiverId,
      conversationId,
      message,
      messageType || "text",
    );

    if (storedMsg) {
      // Broadcast only to users in this conversation
      io.to(`conversation_${conversationId}`).emit("receive_message", {
        id: storedMsg.id,
        senderId: storedMsg.sender_id,
        receiverId: storedMsg.receiver_id,
        message: storedMsg.message_text,
        messageType: storedMsg.message_type,
        timestamp: storedMsg.created_at,
      });
    }
  });

  // Delete message (sender only)
  socket.on("delete_message", async ({ messageId, conversationId }) => {
    if (!currentUser) {
      socket.emit("error", { error: "Not authenticated" });
      return;
    }

    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("id", messageId)
      .eq("sender_id", currentUser.id);

    if (!error) {
      io.to(`conversation_${conversationId}`).emit("message_deleted", {
        messageId,
      });
    }
  });

  // Clear conversation (both users)
  socket.on("clear_conversation", async (conversationId) => {
    if (!currentUser) {
      socket.emit("error", { error: "Not authenticated" });
      return;
    }

    await supabase
      .from("chat_messages")
      .delete()
      .eq("conversation_id", conversationId);

    io.to(`conversation_${conversationId}`).emit("conversation_cleared");
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
    activeConversations.clear();
  });
});

/* =========================
   RESEND EMAIL
========================= */

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, html }) {
  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "EduFund <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email failed:", err);
    return false;
  }
}

/* =========================
   DATABASE INITIALIZATION
========================= */
async function initializeTables() {
  try {
    // Check if conversations table exists by trying to query it
    const { error: checkError } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (checkError?.code === "PGRST205") {
      // Table doesn't exist, we need to create it
      console.log("Creating chat tables via HTTP API...");

      const pgRestUrl = process.env.VITE_SUPABASE_URL + "/rest/v1";
      const serviceKey = process.env.SUPABASE_SERVICE_KEY;

      const sqlStatements = [
        `CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user1_id, user2_id)
        );`,

        `CREATE TABLE IF NOT EXISTS chat_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          message_text TEXT NOT NULL,
          message_type VARCHAR(20) DEFAULT 'text',
          is_deleted BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
        );`,

        `CREATE TABLE IF NOT EXISTS blocked_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(blocker_id, blocked_id)
        );`,

        `CREATE TABLE IF NOT EXISTS user_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          reason VARCHAR(100) NOT NULL,
          message TEXT,
          resolved BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
        );`,

        // Create indexes
        `CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);`,
        `CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);`,
        `CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);`,
        `CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);`,

        // Enable RLS
        `ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;`,

        // Conversations policies
        `DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;`,
        `CREATE POLICY "Users can view their own conversations" ON conversations FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);`,

        `DROP POLICY IF EXISTS "Users can insert conversations" ON conversations;`,
        `CREATE POLICY "Users can insert conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);`,

        // Chat messages policies
        `DROP POLICY IF EXISTS "Users can view messages in their conversations" ON chat_messages;`,
        `CREATE POLICY "Users can view messages in their conversations" ON chat_messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());`,

        `DROP POLICY IF EXISTS "Users can insert their own messages" ON chat_messages;`,
        `CREATE POLICY "Users can insert their own messages" ON chat_messages FOR INSERT WITH CHECK (sender_id = auth.uid());`,
      ];

      // Try using the Supabase REST API to execute a simple query
      // First, test the connection
      try {
        const testResult = await supabase.rpc("version", {});
        console.log("Database version check - no exec_sql RPC available");
      } catch (e) {
        console.log(
          "Note: exec_sql RPC not available, tables may need manual creation",
        );
      }

      console.log("⚠️ Chat tables need to be created manually");
      console.log(
        "Please run the migrations in supabase/migrations/007_add_chat_tables.sql",
      );
    } else if (!checkError) {
      console.log("✅ Chat tables already exist");
    } else {
      console.error("Error checking tables:", checkError);
    }
  } catch (error) {
    console.error("Database initialization warning:", error.message);
    console.log("Proceeding without table creation - they may already exist");
  }
}

// Initialize tables on startup
// DISABLED: Using migration 009_fix_chat_system.sql instead
// initializeTables();

/* =========================
   PAYMENT REMINDERS STORE (IN-MEMORY)
========================= */
const paymentReminders = new Map(); // orderId -> { userEmail, expiresAt, loan_id }

/* =========================
   WALLET & ACCESS MIDDLEWARE
========================= */
async function checkWalletAccess(userEmail) {
  try {
    const { data: wallet, error } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Wallet fetch error:", error);
      return { allowed: true, wallet: null }; // Allow if no wallet exists yet
    }

    if (!wallet) {
      // Create wallet on first check
      const { data: newWallet } = await supabase
        .from("user_wallets")
        .insert([{ user_email: userEmail }])
        .select()
        .single();
      return { allowed: true, wallet: newWallet };
    }

    const allowed = !wallet.is_blocked && wallet.wallet_remaining > 0;
    return {
      allowed,
      wallet,
      reason: wallet.is_blocked ? "Account blocked" : "Wallet limit exceeded",
    };
  } catch (err) {
    console.error("Wallet check error:", err);
    return { allowed: true, wallet: null };
  }
}

async function recordTransaction(
  userEmail,
  loanId,
  type,
  amount,
  status,
  description,
) {
  try {
    await supabase.from("transactions").insert([
      {
        user_email: userEmail,
        loan_id: loanId,
        transaction_type: type,
        amount,
        status,
        description,
      },
    ]);
  } catch (err) {
    console.error("Transaction record error:", err);
  }
}

async function startPaymentReminder(userEmail, orderId, loanId) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  paymentReminders.set(orderId, { userEmail, expiresAt, loanId });

  // Save to DB
  await supabase.from("payment_reminders").insert([
    {
      user_email: userEmail,
      loan_id: loanId,
      order_id: orderId,
      expired_at: expiresAt.toISOString(),
    },
  ]);

  // Send immediate reminder email
  await sendEmail({
    to: userEmail,
    subject: "⏰ Payment Reminder: 1 Hour Left",
    html: `
      <h2>Payment Time Remaining</h2>
      <p>You have <strong>1 hour</strong> left to complete your payment for Loan <strong>${loanId}</strong>.</p>
      <p>Please complete the payment before it expires.</p>
      <p style="margin-top: 20px; color: #999;">If you don't complete the payment in time, your account will be temporarily locked.</p>
    `,
  });

  // Schedule expiration check
  setTimeout(
    async () => {
      const reminder = paymentReminders.get(orderId);
      if (reminder && Date.now() >= reminder.expiresAt.getTime()) {
        // Lock user account
        await supabase
          .from("user_wallets")
          .update({ is_blocked: true })
          .eq("user_email", reminder.userEmail);

        // Notify admin
        await sendEmail({
          to: process.env.ADMIN_EMAIL || "edufund0099@gmail.com",
          subject: "⚠️ Payment Expired - User Locked",
          html: `
          <h3>Payment Timeout Alert</h3>
          <p>User <strong>${reminder.userEmail}</strong> did not complete payment for Loan <strong>${reminder.loanId}</strong> within 1 hour.</p>
          <p>Account has been <strong>automatically locked</strong>.</p>
          <p><strong>Action Required:</strong> Review and unlock manually if needed.</p>
        `,
        });

        // Mark reminder as expired
        await supabase
          .from("payment_reminders")
          .update({ is_expired: true })
          .eq("order_id", orderId);

        paymentReminders.delete(orderId);
      }
    },
    60 * 60 * 1000,
  ); // Check after 1 hour
}

/* =========================
   CHAT API ENDPOINTS
========================= */

// Get conversations for authenticated user
app.get("/api/chat/conversations", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if database is ready
    const dbReady = await isDatabaseReady();

    if (!dbReady) {
      // Return conversations from in-memory storage
      const userConvs = Array.from(conversations.values()).filter(
        (conv) => conv.user1_id === userId || conv.user2_id === userId,
      );
      return res.json(userConvs);
    }

    // Use database
    const { data, error } = await supabase
      .from("conversations")
      .select("*, user1:user1_id(*), user2:user2_id(*)")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order("updated_at", { ascending: false });

    if (error) {
      // Fallback to in-memory if database query fails
      if (error.code === "PGRST205") {
        const userConvs = Array.from(conversations.values()).filter(
          (conv) => conv.user1_id === userId || conv.user2_id === userId,
        );
        return res.json(userConvs);
      }
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    // Fallback to empty array instead of error
    res.json([]);
  }
});

// Create or get conversation
app.post("/api/chat/conversations", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { user1_id, user2_id } = req.body;

    if (!user1_id || !user2_id) {
      return res.status(400).json({ error: "user1_id and user2_id required" });
    }

    // Verify user is creating conversation with themselves
    if (userId !== user1_id && userId !== user2_id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Check if database is ready
    const dbReady = await isDatabaseReady();

    if (!dbReady) {
      // Use in-memory storage
      const conversationKey = [user1_id, user2_id].sort().join("-");

      let conv = conversations.get(conversationKey);
      if (!conv) {
        conv = {
          id: conversationKey,
          user1_id,
          user2_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          messages: [],
        };
        conversations.set(conversationKey, conv);
        console.log(`✅ Created in-memory conversation: ${conversationKey}`);
      }

      return res.json(conv);
    }

    // Check if conversation exists
    const { data: existing, error: existError } = await supabase
      .from("conversations")
      .select("*")
      .or(
        `and(user1_id.eq.${user1_id},user2_id.eq.${user2_id}),and(user1_id.eq.${user2_id},user2_id.eq.${user1_id})`,
      )
      .single();

    if (existing) {
      return res.json(existing);
    }

    // Create new conversation
    const { data: newConv, error: createError } = await supabase
      .from("conversations")
      .insert([
        {
          user1_id,
          user2_id,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ])
      .select()
      .single();

    if (createError) {
      // Fallback to in-memory
      const conversationKey = [user1_id, user2_id].sort().join("-");
      let conv = conversations.get(conversationKey);
      if (!conv) {
        conv = {
          id: conversationKey,
          user1_id,
          user2_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          messages: [],
        };
        conversations.set(conversationKey, conv);
        console.log(
          `✅ Created in-memory conversation (fallback): ${conversationKey}`,
        );
      }
      return res.json(conv);
    }

    res.json(newConv);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Get messages for a specific conversation
app.get(
  "/api/chat/conversation/:conversationId/messages",
  authenticateUser,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { conversationId } = req.params;

      // Verify user is part of conversation
      const { data: conv, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .single();

      if (convError || !conv) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const messages = await getConversationMessages(userId, conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  },
);

// Block user
app.post("/api/chat/block-user", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { blockedUserId } = req.body;

    const { error } = await supabase
      .from("blocked_users")
      .insert([{ blocker_id: userId, blocked_id: blockedUserId }]);

    if (error && !error.message.includes("duplicate")) {
      throw error;
    }

    res.json({ success: true, message: "User blocked" });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ error: "Failed to block user" });
  }
});

// Report user
app.post("/api/chat/report-user", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reportedUserId, reason, message } = req.body;

    const { error } = await supabase.from("user_reports").insert([
      {
        reporter_id: userId,
        reported_id: reportedUserId,
        reason,
        message,
        created_at: new Date(),
      },
    ]);

    if (error) throw error;

    // Notify admin
    await sendEmail({
      to: process.env.ADMIN_EMAIL || "edufund0099@gmail.com",
      subject: `⚠️ User Report: ${reason}`,
      html: `
        <h3>New User Report</h3>
        <p><strong>Reporter:</strong> ${req.user.email}</p>
        <p><strong>Reported User:</strong> ${reportedUserId}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Message:</strong> ${message}</p>
      `,
    });

    res.json({ success: true, message: "Report submitted" });
  } catch (error) {
    console.error("Error reporting user:", error);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

/* =========================
   ADMIN: GET ALL TRANSACTIONS
========================= */

app.get("/api/transactions", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (error.code === "PGRST205") {
        // Table doesn't exist
        return res.json({ ok: true, transactions: [] });
      }
      console.error("Admin transactions fetch error:", error);
      return res.json({ ok: true, transactions: [] });
    }
    res.json({ ok: true, transactions: data || [] });
  } catch (err) {
    console.error("Admin transactions fetch error:", err);
    res.json({ ok: true, transactions: [] });
  }
});

/* =========================
   API: HEALTH CHECK
========================= */

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

/* =========================
   API: GET WALLET
========================= */

app.get("/api/wallet/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { data: wallet, error } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    // If table doesn't exist or no wallet record, return default
    if (error) {
      if (error.code === "PGRST116" || error.code === "PGRST205") {
        // No matching row or table doesn't exist
        return res.json({
          ok: true,
          wallet: {
            user_email: userEmail,
            wallet_limit: 100.0,
            wallet_spent: 0.0,
            wallet_remaining: 100.0,
            is_blocked: false,
          },
        });
      }
      console.error("Wallet fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch wallet" });
    }

    res.json({ ok: true, wallet });
  } catch (err) {
    console.error("Wallet fetch error:", err);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

/* =========================
   API: GET LOANS FOR USER
========================= */

app.get("/api/loans/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { data: loans, error } = await supabase
      .from("loans")
      .select("id, amount, reason, status, applied_at, student_email")
      .eq("student_email", userEmail)
      .order("applied_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205") {
        // Table doesn't exist
        return res.json({ ok: true, loans: [] });
      }
      console.error("Loans fetch error:", error);
      return res.json({ ok: true, loans: [] });
    }

    res.json({ ok: true, loans: loans || [] });
  } catch (err) {
    console.error("Loans fetch error:", err);
    res.json({ ok: true, loans: [] });
  }
});

/* =========================
   API: GET TRANSACTIONS
========================= */

app.get("/api/transactions/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    // Extract domain part for group (after @)
    const emailGroup = userEmail.split("@")[1];
    let transactions = [];
    let error = null;
    if (emailGroup) {
      // Fetch all transactions for users with same email domain
      const result = await supabase
        .from("transactions")
        .select("*")
        .ilike("user_email", `%@${emailGroup}`)
        .order("created_at", { ascending: false });
      transactions = result.data;
      error = result.error;
    } else {
      // fallback to exact match
      const result = await supabase
        .from("transactions")
        .select("*")
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false });
      transactions = result.data;
      error = result.error;
    }

    // If table doesn't exist, return empty array
    if (error) {
      if (error.code === "PGRST205") {
        // Table doesn't exist
        return res.json({ ok: true, transactions: [] });
      }
      console.error("Transactions fetch error:", error);
      return res.json({ ok: true, transactions: [] });
    }

    // If no transactions, fetch user's loan requests as fallback
    if (!transactions || transactions.length === 0) {
      // Get all loans for this user
      const { data: loans, error: loanError } = await supabase
        .from("loans")
        .select("id, amount, reason, status, applied_at")
        .eq("student_email", userEmail)
        .order("applied_at", { ascending: false });
      if (!loanError && loans && loans.length > 0) {
        // Map loans to transaction-like objects
        const loanTransactions = loans.map((loan) => ({
          id: loan.id,
          amount: loan.amount,
          transaction_type: "loan_request",
          status: loan.status,
          description: `Loan Requested - ₹${loan.amount} for ${loan.reason}`,
          created_at: loan.applied_at,
        }));
        return res.json({ ok: true, transactions: loanTransactions });
      }
    }

    res.json({ ok: true, transactions: transactions || [] });
  } catch (err) {
    console.error("Transactions fetch error:", err);
    res.json({ ok: true, transactions: [] });
  }
});

/* =========================
   API: ADMIN - EXTEND WALLET LIMIT
========================= */

app.post("/api/admin/extend-wallet", async (req, res) => {
  try {
    const { userEmail, additionalAmount, adminEmail } = req.body;

    // Verify admin (in production, verify JWT token)
    if (adminEmail !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { data: wallet, error } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    if (error) {
      return res.status(404).json({ error: "User wallet not found" });
    }

    const newLimit = wallet.wallet_limit + additionalAmount;
    const newRemaining = wallet.wallet_remaining + additionalAmount;

    const { data: updated } = await supabase
      .from("user_wallets")
      .update({
        wallet_limit: newLimit,
        wallet_remaining: newRemaining,
        is_blocked: false, // Unblock if locked
      })
      .eq("user_email", userEmail)
      .select()
      .single();

    // Notify user
    await sendEmail({
      to: userEmail,
      subject: "🎉 Wallet Limit Extended",
      html: `
        <h3>Your Wallet Limit Has Been Extended!</h3>
        <p>Your wallet limit has been increased by <strong>₹${additionalAmount}</strong>.</p>
        <p><strong>New Limit:</strong> ₹${newLimit}</p>
        <p>You can now make more transactions.</p>
      `,
    });

    res.json({ ok: true, wallet: updated });
  } catch (err) {
    console.error("Extend wallet error:", err);
    res.status(500).json({ error: "Failed to extend wallet" });
  }
});

/* =========================
   RAZORPAY: CREATE ORDER
========================= */

app.post("/api/create-order", async (req, res) => {
  try {
    const { loanId, studentId, amount } = req.body;

    if (!loanId || !studentId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check wallet access
    const { allowed, reason } = await checkWalletAccess(studentId);
    if (!allowed) {
      return res.status(403).json({ error: reason || "Wallet limit exceeded" });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Amount in paise (smallest currency unit)
      currency: "INR",
      receipt: `loan_${loanId}_${Date.now()}`,
      notes: {
        loanId,
        studentId,
      },
    });

    // Start 1-hour payment reminder
    await startPaymentReminder(studentId, order.id, loanId);

    // Record pending transaction
    await recordTransaction(
      studentId,
      loanId,
      "debit",
      amount,
      "pending",
      `Payment initiated for loan ${loanId}`,
    );

    res.json({
      ok: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

/* =========================
   RAZORPAY: VERIFY PAYMENT
========================= */

app.post("/api/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      loanId,
      studentId,
      amount,
    } = req.body;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Store payment in database
    const { data, error } = await supabase
      .from("payments")
      .insert([
        {
          loan_id: loanId,
          student_id: studentId,
          amount,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          status: "success",
          paid_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Payment DB error:", error);
      return res.status(500).json({ error: "Failed to record payment" });
    }

    // Update transaction to completed
    await supabase
      .from("transactions")
      .update({ status: "completed", razorpay_payment_id })
      .eq("loan_id", loanId)
      .eq("user_email", studentId);

    // Update wallet spent amount
    await supabase
      .rpc("update_wallet_spent", {
        p_email: studentId,
        p_amount: amount,
      })
      .catch(() => {
        // Fallback: manually update if RPC doesn't exist
        supabase
          .from("user_wallets")
          .update({
            wallet_spent: supabase.rpc("coalesce", [
              supabase
                .from("user_wallets")
                .select("wallet_spent")
                .eq("user_email", studentId),
              0,
            ]),
          })
          .eq("user_email", studentId);
      });

    // Update loan status if needed
    await supabase.from("loans").update({ status: "paid" }).eq("id", loanId);

    // Send confirmation email to user
    await sendEmail({
      to: studentId,
      subject: "✅ Payment Successful",
      html: `
        <h3>Payment Successful!</h3>
        <p>Your payment of <strong>₹${amount}</strong> has been received.</p>
        <p><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
        <p><strong>Loan ID:</strong> ${loanId}</p>
        <p style="margin-top: 20px; color: #666;">Thank you for completing your payment on time!</p>
      `,
    });

    // Send notification to admin
    await sendEmail({
      to: process.env.ADMIN_EMAIL || "edufund0099@gmail.com",
      subject: "💰 Payment Received",
      html: `
        <h3>New Payment Received</h3>
        <p><strong>Student:</strong> ${studentId}</p>
        <p><strong>Amount:</strong> ₹${amount}</p>
        <p><strong>Loan ID:</strong> ${loanId}</p>
        <p><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
      `,
    });

    res.json({ ok: true, payment: data });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ error: "Payment verification failed" });
  }
});

/* =========================
   APPLY LOAN
========================= */

app.post("/api/apply-loan", async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      college,
      amount,
      reason,
      account_number,
      account_holder_name,
      bank_name,
      ifsc_code,
    } = req.body;

    if (
      !full_name ||
      !email ||
      !phone ||
      !college ||
      !amount ||
      !reason ||
      !account_number ||
      !account_holder_name ||
      !ifsc_code
    ) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (Number(amount) > 1500) {
      return res.status(400).json({ error: "Max ₹1500 allowed" });
    }

    const { data, error } = await supabase
      .from("loans")
      .insert([
        {
          student_name: full_name,
          student_email: email,
          phone,
          college,
          amount,
          reason,
          account_number,
          account_holder_name,
          bank_name,
          ifsc_code,
          status: "applied",
          applied_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "DB insert failed" });
    }

    // Admin email (optional)
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "📄 New Loan Application",
      html: `
        <h3>New Loan Request</h3>
        <p>Name: ${full_name}</p>
        <p>Amount: ₹${amount}</p>
        <p>Loan ID: ${data.id}</p>
      `,
    });

    // Student email (optional)
    await sendEmail({
      to: email,
      subject: "Loan Application Submitted",
      html: `
        <p>Hi ${full_name},</p>
        <p>Your loan request has been submitted.</p>
        <p>Loan ID: ${data.id}</p>
      `,
    });

    // Record transaction for loan request
    await recordTransaction(
      email, // userEmail
      data.id, // loanId
      "loan_request", // type
      amount, // amount
      "pending", // status
      `Loan Requested - ₹${amount} for ${reason}`, // description
    );

    res.json({ ok: true, loan: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   ADMIN CHAT ENDPOINTS
========================= */

// Middleware to verify admin
const verifyAdmin = async (req, res, next) => {
  const user = await verifyJWT(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check if user is admin (you can add an is_admin field to users table or check by email)
  const { data: adminUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminUser || adminUser.role !== "admin") {
    // Fallback: check if email is admin email
    if (user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: "Admin access required" });
    }
  }

  req.user = user;
  next();
};

// GET - Admin: List all conversations with users
app.get("/api/admin/conversations", verifyAdmin, async (req, res) => {
  try {
    const adminId = req.user.id;

    const { data: conversations, error } = await supabase
      .from("conversations")
      .select(
        `
        id,
        user1_id,
        user2_id,
        created_at,
        updated_at
      `,
      )
      .or(`user1_id.eq.${adminId},user2_id.eq.${adminId}`)
      .order("updated_at", { ascending: false });

    if (error) {
      return res
        .status(500)
        .json({ error: "Failed to fetch conversations", details: error });
    }

    // Get user info and last message for each conversation
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId =
          conv.user1_id === adminId ? conv.user2_id : conv.user1_id;

        // Get user info
        const { data: userData } = await supabase
          .from("users")
          .select("id, email, first_name, last_name, avatar")
          .eq("id", otherUserId)
          .single();

        // Get last message
        const { data: lastMsg } = await supabase
          .from("chat_messages")
          .select("message_text, created_at, sender_id")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return {
          id: conv.id,
          user: userData,
          lastMessage: lastMsg
            ? {
                text: lastMsg.message_text,
                timestamp: lastMsg.created_at,
                isSent: lastMsg.sender_id === adminId,
              }
            : null,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
        };
      }),
    );

    res.json({ conversations: enrichedConversations });
  } catch (err) {
    console.error("Error fetching admin conversations:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET - Admin: Get all messages in a conversation with a specific user
app.get(
  "/api/admin/conversations/:userId/messages",
  verifyAdmin,
  async (req, res) => {
    try {
      const adminId = req.user.id;
      const userId = req.params.userId;

      // Find conversation between admin and user
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(user1_id.eq.${adminId},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${adminId})`,
        )
        .limit(1)
        .single();

      if (convError || !conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Get all messages
      const { data: messages, error: msgError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (msgError) {
        return res.status(500).json({ error: "Failed to fetch messages" });
      }

      // Get user info
      const { data: userData } = await supabase
        .from("users")
        .select("id, email, first_name, last_name, avatar")
        .eq("id", userId)
        .single();

      res.json({
        conversationId: conversation.id,
        user: userData,
        messages: messages,
      });
    } catch (err) {
      console.error("Error fetching conversation messages:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// POST - Admin: Send message to a user
app.post(
  "/api/admin/conversations/:userId/message",
  verifyAdmin,
  async (req, res) => {
    try {
      const adminId = req.user.id;
      const userId = req.params.userId;
      const { message } = req.body;

      if (!message || message.trim() === "") {
        return res.status(400).json({ error: "Message cannot be empty" });
      }

      // Get or create conversation
      let conversation = await getOrCreateConversation(adminId, userId);

      if (!conversation) {
        return res.status(500).json({ error: "Failed to create conversation" });
      }

      // Store message
      const { data: messageData, error: msgError } = await supabase
        .from("chat_messages")
        .insert([
          {
            conversation_id: conversation.id,
            sender_id: adminId,
            receiver_id: userId,
            message_text: message,
            message_type: "text",
            created_at: new Date(),
          },
        ])
        .select()
        .single();

      if (msgError) {
        return res.status(500).json({ error: "Failed to send message" });
      }

      // Emit via socket if user is online
      io.to(`conversation_${conversation.id}`).emit("message", {
        id: messageData.id,
        senderId: adminId,
        receiverId: userId,
        message: messageData.message_text,
        timestamp: messageData.created_at,
      });

      res.json({ message: messageData });
    } catch (err) {
      console.error("Error sending admin message:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// GET - Admin: Get chat statistics
app.get("/api/admin/chat-stats", verifyAdmin, async (req, res) => {
  try {
    const adminId = req.user.id;

    // Total conversations
    const { count: totalConversations } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .or(`user1_id.eq.${adminId},user2_id.eq.${adminId}`);

    // Total messages
    const { count: totalMessages } = await supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .or(`sender_id.eq.${adminId},receiver_id.eq.${adminId}`);

    // Unread messages for admin
    const { count: unreadMessages } = await supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", adminId)
      .eq("is_read", false);

    res.json({
      totalConversations: totalConversations || 0,
      totalMessages: totalMessages || 0,
      unreadMessages: unreadMessages || 0,
    });
  } catch (err) {
    console.error("Error fetching chat stats:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   ROOT
========================= */

app.get("/", (_, res) => {
  res.json({ ok: true, message: "EduFund backend running" });
});

/* =========================
   DISBURSEMENT REQUESTS API
========================= */

// User: Create disbursement request
app.post("/api/disbursement-request", authenticateUser, async (req, res) => {
  try {
    const {
      loanId,
      amount,
      bankAccountNumber,
      bankAccountHolder,
      bankName,
      ifscCode,
    } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    if (!loanId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create disbursement request
    const { data: request, error } = await supabase
      .from("disbursement_requests")
      .insert([
        {
          loan_id: loanId,
          user_id: userId,
          user_email: userEmail,
          amount,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST205") {
        // Table doesn't exist yet, return helpful message
        return res.status(500).json({
          error: "Disbursement system not yet available. Please contact admin.",
          details: "Database migration pending",
        });
      }
      console.error("Create request error:", error);
      return res
        .status(500)
        .json({ error: "Failed to create disbursement request" });
    }

    // Update loan with bank details
    await supabase
      .from("loans")
      .update({
        disbursement_status: "pending",
        disbursement_request_id: request.id,
        bank_account_number: bankAccountNumber,
        bank_account_holder: bankAccountHolder,
        bank_name: bankName,
        ifsc_code: ifscCode,
      })
      .eq("id", loanId);

    // Create or get conversation for this request
    const adminEmail = "edufund0099@gmail.com";

    // Get admin user ID
    const { data: adminUser } = await supabase.auth.admin.listUsers();
    const admin = adminUser?.users?.find((u) => u.email === adminEmail);

    if (admin) {
      // Create conversation if doesn't exist
      const { data: conv } = await supabase
        .from("conversations")
        .insert([
          {
            user_id: userId,
            admin_id: admin.id,
            user_email: userEmail,
            admin_email: adminEmail,
            category: "disbursement_request",
            related_request_id: request.id,
          },
        ])
        .select()
        .single();

      // Send initial message about request
      if (conv) {
        await supabase.from("chat_messages").insert([
          {
            conversation_id: conv.id,
            sender_id: userId,
            receiver_id: admin.id,
            message_text: `Disbursement Request: ₹${amount} for Loan ${loanId}`,
            status: "sent",
          },
        ]);
      }
    }

    // Send email to admin
    await sendEmail({
      to: adminEmail,
      subject: `💰 New Disbursement Request from ${userEmail}`,
      html: `
        <h3>New Disbursement Request</h3>
        <p><strong>User:</strong> ${userEmail}</p>
        <p><strong>Loan ID:</strong> ${loanId}</p>
        <p><strong>Amount:</strong> ₹${amount}</p>
        <p><strong>Status:</strong> Pending Review</p>
        <p>Please check the admin panel to approve or reject this request.</p>
      `,
    });

    res.json({ ok: true, request });
  } catch (err) {
    console.error("Disbursement request error:", err);
    res.status(500).json({ error: "Failed to create disbursement request" });
  }
});

// Admin: Get all disbursement requests
app.get("/api/admin/disbursement-requests", async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from("disbursement_requests")
      .select("*")
      .order("requested_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205") {
        // Table doesn't exist, return empty list
        return res.json({ ok: true, requests: [] });
      }
      console.error("Fetch requests error:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch disbursement requests" });
    }

    res.json({ ok: true, requests: requests || [] });
  } catch (err) {
    console.error("Get requests error:", err);
    res.status(500).json({ error: "Failed to fetch disbursement requests" });
  }
});

// Admin: Get single disbursement request
app.get("/api/admin/disbursement-requests/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: request, error } = await supabase
      .from("disbursement_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !request) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json({ ok: true, request });
  } catch (err) {
    console.error("Get request error:", err);
    res.status(500).json({ error: "Failed to fetch disbursement request" });
  }
});

// Admin: Approve disbursement request
app.post("/api/admin/disbursement-requests/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    // Get request
    const { data: request } = await supabase
      .from("disbursement_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Update request status
    const { data: updated } = await supabase
      .from("disbursement_requests")
      .update({
        status: "approved",
        admin_notes: adminNotes,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    // Update loan status
    await supabase
      .from("loans")
      .update({ disbursement_status: "approved" })
      .eq("id", request.loan_id);

    // Send email to user
    await sendEmail({
      to: request.user_email,
      subject: `✅ Disbursement Approved - Loan ${request.loan_id}`,
      html: `
        <h3>Your Disbursement Request Has Been Approved!</h3>
        <p><strong>Loan ID:</strong> ${request.loan_id}</p>
        <p><strong>Amount:</strong> ₹${request.amount}</p>
        <p><strong>Status:</strong> Approved</p>
        <p>Your loan will be disbursed shortly to your registered bank account.</p>
        ${
          adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ""
        }
      `,
    });

    res.json({ ok: true, request: updated });
  } catch (err) {
    console.error("Approve request error:", err);
    res.status(500).json({ error: "Failed to approve disbursement request" });
  }
});

// Admin: Disburse request
app.post("/api/admin/disbursement-requests/:id/disburse", async (req, res) => {
  try {
    const { id } = req.params;

    // Get request
    const { data: request } = await supabase
      .from("disbursement_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Update request status
    const { data: updated } = await supabase
      .from("disbursement_requests")
      .update({
        status: "disbursed",
        disbursed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    // Update loan status
    await supabase
      .from("loans")
      .update({ disbursement_status: "disbursed" })
      .eq("id", request.loan_id);

    // Send email to user
    await sendEmail({
      to: request.user_email,
      subject: `💸 Disbursement Complete - Loan ${request.loan_id}`,
      html: `
        <h3>Your Loan Has Been Disbursed!</h3>
        <p><strong>Loan ID:</strong> ${request.loan_id}</p>
        <p><strong>Amount:</strong> ₹${request.amount}</p>
        <p><strong>Status:</strong> Disbursed</p>
        <p>The amount has been transferred to your registered bank account.</p>
        <p>Please allow 1-2 business days for the amount to reflect in your account.</p>
      `,
    });

    res.json({ ok: true, request: updated });
  } catch (err) {
    console.error("Disburse request error:", err);
    res.status(500).json({ error: "Failed to disburse request" });
  }
});

// Admin: Reject disbursement request
app.post("/api/admin/disbursement-requests/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get request
    const { data: request } = await supabase
      .from("disbursement_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Update request status
    const { data: updated } = await supabase
      .from("disbursement_requests")
      .update({
        status: "rejected",
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    // Update loan status
    await supabase
      .from("loans")
      .update({ disbursement_status: "rejected" })
      .eq("id", request.loan_id);

    // Send email to user
    await sendEmail({
      to: request.user_email,
      subject: `❌ Disbursement Request Rejected - Loan ${request.loan_id}`,
      html: `
        <h3>Your Disbursement Request Has Been Rejected</h3>
        <p><strong>Loan ID:</strong> ${request.loan_id}</p>
        <p><strong>Amount:</strong> ₹${request.amount}</p>
        <p><strong>Status:</strong> Rejected</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>Please contact our support team for more information.</p>
      `,
    });

    res.json({ ok: true, request: updated });
  } catch (err) {
    console.error("Reject request error:", err);
    res.status(500).json({ error: "Failed to reject disbursement request" });
  }
});

/* =========================
   LOAN APPLICATIONS API
========================= */

// Admin: Get all loan applications
app.get("/api/admin/loan-applications", async (req, res) => {
  try {
    const { data: applications, error } = await supabase
      .from("loans")
      .select("*")
      .order("applied_at", { ascending: false });

    if (error) {
      console.error("Fetch loan applications error:", error);
      // If table or column doesn't exist, return empty array
      if (error.code === "PGRST205" || error.code === "PGRST116") {
        return res.json({ ok: true, applications: [] });
      }
      return res
        .status(500)
        .json({ error: "Failed to fetch loan applications" });
    }

    res.json({ ok: true, applications: applications || [] });
  } catch (err) {
    console.error("Get loan applications error:", err);
    res.json({ ok: true, applications: [] });
  }
});

// Admin: Update loan status and record transaction
app.post("/api/update-loan-status", async (req, res) => {
  try {
    const { loanId, status, studentEmail } = req.body;

    if (!loanId || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get loan details
    const { data: loan } = await supabase
      .from("loans")
      .select("*")
      .eq("id", loanId)
      .single();

    if (!loan) {
      return res.status(404).json({ error: "Loan not found" });
    }

    // Update loan status
    const { error: updateError } = await supabase
      .from("loans")
      .update({ status })
      .eq("id", loanId);

    if (updateError) {
      console.error("Update loan error:", updateError);
      return res.status(500).json({ error: "Failed to update loan status" });
    }

    // Record transaction for ALL status changes (approval, rejection, and disbursement)
    let transactionType = "";
    let description = "";
    let transactionStatus = "completed";

    if (status === "approved") {
      transactionType = "approval";
      description = `Loan Approved - ₹${loan.amount} for ${loan.reason}`;
    } else if (status === "disbursed") {
      transactionType = "disbursement";
      description = `Loan Disbursed - ₹${loan.amount} for ${loan.reason}`;
    } else if (status === "rejected") {
      transactionType = "rejection";
      description = `Loan Rejected - ₹${loan.amount} for ${loan.reason}`;
      transactionStatus = "failed";
    }

    // Insert transaction record
    const { error: txError } = await supabase.from("transactions").insert([
      {
        user_email: studentEmail || loan.student_email,
        loan_id: loanId,
        transaction_type: transactionType,
        amount: loan.amount,
        status: transactionStatus,
        description,
        created_at: new Date().toISOString(),
      },
    ]);

    if (txError) {
      console.error("Transaction insert error:", txError);
      // Don't fail the request if transaction insert fails
    }

    res.json({ ok: true, message: `Loan ${status}` });
  } catch (err) {
    console.error("Update loan status error:", err);
    res.status(500).json({ error: "Failed to update loan status" });
  }
});

/* =========================
   INITIALIZE CHAT SYSTEM
========================= */

// Register chat routes (REST APIs)
registerChatRoutes(app, supabase, io);

// Initialize chat Socket.IO handlers
initChatSocket(io, supabase);

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Server + Socket running on http://localhost:${PORT}`);
});
