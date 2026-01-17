import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, AlertCircle, MessageCircle } from "lucide-react";

/* ================= TYPES ================= */
interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  created_at: string;
  status: "sent" | "delivered" | "read";
  is_read: boolean;
}

interface Conversation {
  id: string;
  user_id: string;
  admin_id: string;
  user_email: string;
  admin_email: string;
  last_message_at: string;
  unreadCount?: number;
  lastMessage?: string;
}

/* ================= CONFIG ================= */
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const ADMIN_EMAIL = "edufund0099@gmail.com";

/* ================= COMPONENT ================= */
/**
 * USER CHAT PAGE
 * - Users can only chat with admin (edufund0099@gmail.com)
 * - One 1-to-1 conversation
 * - Real-time messaging with status tracking
 * - Cannot see other users or their chats
 */
export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to latest message */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Initialize chat */
  useEffect(() => {
    const init = async () => {
      try {
        /* Get current user */
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          window.location.href = "/login";
          return;
        }

        /* Verify user is not admin */
        if (user.email === ADMIN_EMAIL) {
          window.location.href = "/admin";
          return;
        }

        setCurrentUser(user);

        /* Sync user to public users table */
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            await fetch(`${API_URL}/chat/sync-user`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
            });
          } catch (err) {
            console.warn("User sync error (non-critical):", err);
          }
        }

        /* Initialize Socket.IO */
        if (!session?.access_token) {
          setError("No session found");
          return;
        }

        const newSocket = io(SOCKET_URL, {
          transports: ["websocket"],
          auth: { token: session.access_token },
        });

        newSocket.on("auth_success", () => {
          console.log("✅ Socket authenticated");
        });

        /* Receive new messages in real-time */
        newSocket.on("message:received", (data: Message) => {
          if (data.receiver_id === user.id) {
            setMessages((prev) => [...prev, data]);
            // Mark as delivered
            if (data.status === "sent") {
              markMessageAsDelivered(data.id);
            }
          }
        });

        /* Receive typing indicators */
        newSocket.on("user:typing", () => {
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 3000);
        });

        newSocket.on("user:stop_typing", () => {
          setIsTyping(false);
        });

        newSocket.on("connect_error", (error) => {
          console.error("Socket error:", error);
          setError("Connection error");
        });

        setSocket(newSocket);

        /* Fetch or create conversation with admin */
        await getOrCreateConversation(user, session.access_token);
        setLoading(false);
      } catch (err) {
        console.error("Init error:", err);
        setError(String(err));
        setLoading(false);
      }
    };

    init();

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  /* Get or create conversation */
  const getOrCreateConversation = async (user: any, token: string) => {
    try {
      const response = await fetch(`${API_URL}/chat/conversations`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setError("Failed to fetch conversation");
        return;
      }

      const data = await response.json();
      const conversations = data.conversations || data || [];

      console.log("Fetched conversations:", conversations);

      if (conversations.length > 0) {
        const conv = conversations[0];
        if (!conv || !conv.id) {
          console.error("Invalid conversation structure:", conv);
          setError("Invalid conversation data");
          return;
        }
        setConversationId(conv.id);
        await loadMessages(conv.id, token);
        // Join socket room
        if (socket) {
          socket.emit("join_conversation", { conversationId: conv.id });
        }
      } else {
        /* Create new conversation */
        // Regular user initiating conversation with admin - don't send userId
        console.log("Creating new conversation with user:", user);
        const createRes = await fetch(`${API_URL}/chat/conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}), // Empty body - backend will create with current user and admin
        });

        console.log("Create conversation response status:", createRes.status, createRes.ok);

        if (!createRes.ok) {
          const errorData = await createRes.text();
          console.error("Create conversation failed:", createRes.status, errorData);
          setError(`Failed to create conversation: ${createRes.status}`);
          return;
        }

        const newConvData = await createRes.json();
        console.log("Create conversation response:", newConvData);
        
        const newConv = newConvData.conversation || newConvData;
        console.log("Extracted conversation:", newConv);
        
        if (!newConv || !newConv.id) {
          console.error("Invalid response structure:", newConvData);
          setError("Failed to get conversation data");
          return;
        }

        setConversationId(newConv.id);
        // Join socket room
        if (socket) {
          socket.emit("join_conversation", {
            conversationId: newConv.id,
          });
        }
      }
    } catch (err) {
      console.error("Get conversation error:", err);
      setError(String(err));
    }
  };

  /* Load messages for conversation */
  const loadMessages = async (convId: string, token: string) => {
    try {
      const response = await fetch(`${API_URL}/chat/messages/${convId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setError("Failed to load messages");
        return;
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Load messages error:", err);
      setError(String(err));
    }
  };

  /* Mark message as delivered */
  const markMessageAsDelivered = async (messageId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`${API_URL}/chat/messages/${messageId}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch (err) {
      console.error("Mark as delivered error:", err);
    }
  };

  /* Send message */
  const sendMessage = async () => {
    if (!input.trim() || !conversationId || !currentUser) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      console.log("Sending message:", { conversationId, message: input });

      const response = await fetch(`${API_URL}/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId,
          message: input,
        }),
      });

      console.log("Message response status:", response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Failed to send message:", response.status, errorData);
        return;
      }

      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);
      setInput("");
    } catch (err) {
      console.error("Send error:", err);
      setError(String(err));
    }
  };

  /* Typing indicator */
  const handleTyping = () => {
    if (socket && conversationId) {
      socket.emit("typing", { conversationId });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Loading chat...</div>
      </div>
    );
  }

  if (error && !conversationId) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <p className="text-lg text-red-700 mb-6">{error}</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-semibold">{ADMIN_EMAIL}</p>
            <p className="text-sm text-gray-600">Admin Support</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageCircle className="mx-auto mb-2 w-8 h-8 opacity-50" />
                <p>No messages yet. Say hello!</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender_id === currentUser?.id
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs rounded-lg px-4 py-2 ${
                    msg.sender_id === currentUser?.id
                      ? "bg-blue-500 text-white rounded-br-none"
                      : "bg-gray-100 text-gray-900 rounded-bl-none"
                  }`}
                >
                  <p className="text-sm">{msg.message_text}</p>
                  <div
                    className={`mt-1 flex items-center gap-1 text-xs ${
                      msg.sender_id === currentUser?.id
                        ? "text-blue-100"
                        : "text-gray-500"
                    }`}
                  >
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {msg.sender_id === currentUser?.id && (
                      <span>
                        {msg.status === "read"
                          ? "✓✓"
                          : msg.status === "delivered"
                            ? "✓"
                            : "○"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-3 flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={!conversationId}
          />
          <Button
            onClick={sendMessage}
            disabled={!conversationId || !input.trim()}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
