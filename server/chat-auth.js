/**
 * ============================================
 * CHAT SYSTEM - AUTH & SECURITY
 * ============================================
 * Admin-only access control
 * Data isolation by user
 */

const ADMIN_EMAIL = "edufund0099@gmail.com";

// Development mode - skip Supabase auth (only for local testing!)
// DEV_MODE is true unless explicitly set to production
const DEV_MODE = process.env.NODE_ENV !== "production";

console.log(
  `[AUTH] Mode: ${
    DEV_MODE
      ? "DEVELOPMENT (local JWT parsing)"
      : "PRODUCTION (Supabase verification)"
  }`
);

/**
 * Parse JWT token without verification (DEV ONLY)
 * @param {string} token - JWT token
 * @returns {Object} Decoded token data
 */
function parseJWTPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.log("[AUTH] Invalid JWT format");
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8")
    );
    console.log("[AUTH] Parsed JWT:", {
      sub: decoded.sub,
      email: decoded.email,
    });
    return decoded;
  } catch (err) {
    console.error("[AUTH] JWT parse error:", err.message);
    return null;
  }
}

/**
 * Check if user is admin
 * @param {string} email - User email
 * @returns {boolean} true if admin
 */
export function isAdmin(email) {
  return email === ADMIN_EMAIL;
}

/**
 * Verify JWT token and extract user info
 * @param {string} token - JWT token from Authorization header
 * @param {any} supabase - Supabase client
 * @returns {Promise<Object>} { userId, email, isAdmin }
 */
export async function verifyAuth(token, supabase) {
  try {
    // Development mode: Parse JWT without contacting Supabase
    if (DEV_MODE) {
      console.log("[AUTH] DEV mode: parsing JWT locally");
      const payload = parseJWTPayload(token);
      if (payload?.sub && payload?.email) {
        const result = {
          userId: payload.sub,
          email: payload.email,
          isAdmin: isAdmin(payload.email),
        };
        console.log("[AUTH] DEV auth success:", {
          userId: result.userId,
          email: result.email,
          isAdmin: result.isAdmin,
        });
        return result;
      }
      console.log("[AUTH] DEV mode: JWT missing sub or email");
      return null;
    }

    // Production mode: Verify with Supabase (with timeout)
    console.log("[AUTH] PROD mode: verifying with Supabase");
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Auth verification timeout")), 5000)
    );

    const getUser = supabase.auth.getUser(token);

    const {
      data: { user },
      error,
    } = await Promise.race([getUser, timeoutPromise]);

    if (error || !user) {
      console.error("[AUTH] Supabase auth failed:", error?.message);
      return null;
    }

    const result = {
      userId: user.id,
      email: user.email,
      isAdmin: isAdmin(user.email),
    };
    console.log("[AUTH] PROD auth success:", {
      userId: result.userId,
      email: result.email,
      isAdmin: result.isAdmin,
    });
    return result;
  } catch (err) {
    console.error("[AUTH] Verification error:", err.message);
    return null;
  }
}

/**
 * Middleware: Verify admin access
 * @returns {Function} Express middleware
 */
export function requireAdmin(supabase) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const auth = await verifyAuth(token, supabase);

    if (!auth || !auth.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.user = auth;
    next();
  };
}

/**
 * Middleware: Verify user authentication
 * @returns {Function} Express middleware
 */
export function requireAuth(supabase) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const auth = await verifyAuth(token, supabase);

    if (!auth) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = auth;
    next();
  };
}

/**
 * Verify user can access conversation
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<boolean>}
 */
export async function canAccessConversation(userId, conversationId, supabase) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .or(`user_id.eq.${userId},admin_id.eq.${userId}`)
    .single();

  return !error && !!data;
}

/**
 * Verify user can send message in conversation
 * @param {string} senderId - Sender ID
 * @param {string} receiverId - Receiver ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<boolean>}
 */
export async function canSendMessage(
  senderId,
  receiverId,
  conversationId,
  supabase
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_id, admin_id")
    .eq("id", conversationId)
    .single();

  if (error || !data) return false;

  // Sender must be part of conversation
  const isParticipant = data.user_id === senderId || data.admin_id === senderId;
  // Receiver must be the other party
  const isValidReceiver =
    (data.user_id === receiverId && data.admin_id === senderId) ||
    (data.admin_id === receiverId && data.user_id === senderId);

  return isParticipant && isValidReceiver;
}
