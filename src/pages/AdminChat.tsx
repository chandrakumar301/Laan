import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Search, MessageCircle, AlertCircle } from "lucide-react";
import { io, Socket } from "socket.io-client";

const getApiUrl = () => {
  const url = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
  if (window.location.protocol === "https:" && url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
};

const getSocketUrl = () => {
  const url = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
  if (window.location.protocol === "https:" && url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
};

interface User {
  id: string;
  email: string;
  created_at: string;
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
  lastMessageIsFromMe?: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  created_at: string;
  is_read: boolean;
  status: "sent" | "delivered" | "read";
}

/**
 * ADMIN CHAT DASHBOARD
 * - Left: All users list (filtered by search)
 * - Right: Selected user's 1-to-1 chat
 *
 * SECURITY:
 * - Only edufund0099@gmail.com can access (enforced server-side)
 * - Admin sees all conversations
 * - Each conversation isolated by conversation_id
 * - Messages filtered by sender/receiver IDs
 */
export default function AdminChat() {
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string | undefined;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize: Get current user and verify admin
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          window.location.href = "/login";
          return;
        }

        // Verify admin access
        if (user.email !== "edufund0099@gmail.com") {
          setError("Only admin (edufund0099@gmail.com) can access this page");
          setTimeout(() => {
            window.location.href = "/chat";
          }, 2000);
          return;
        }

        setCurrentUser({ id: user.id, email: user.email || "" });

        // Sync user to public users table
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            await fetch(`${getApiUrl()}/chat/sync-user`, {
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

        // Initialize Socket.IO
        if (session?.access_token) {
          const newSocket = io(getSocketUrl(), {
            auth: { token: session.access_token },
          });

          newSocket.on("auth_success", () => {
            console.log("✅ Admin socket authenticated");
          });

          // Real-time message received (matches backend "message:new" emit)
          newSocket.on("message:new", (data) => {
            if (data.conversation_id === selectedConversationId) {
              setMessages((prev) => [...prev, data]);
              // Mark as delivered
              if (data.receiver_id === user.id && data.status === "sent") {
                markMessageAsDelivered(data.id);
              }
            }
          });

          // Real-time typing indicator
          newSocket.on("user:typing", (data) => {
            console.log("User typing:", data);
          });

          newSocket.on("connect_error", (error) => {
            console.error("Socket connection error:", error);
          });

          setSocket(newSocket);
        }

        // Load users and conversations
        await loadUsers();
        await loadConversations();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load all users (admin endpoint)
  const loadUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`${getApiUrl()}/chat/users`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to load users:", response.status);
        return;
      }

      const data = await response.json();
      console.log("📊 Users loaded:", {
        total: data.count,
        users: data.users?.map((u: User) => u.email),
      });
      setUsers(data.users || []);
    } catch (err) {
      console.error("Load users error:", err);
    }
  };

  // Load all conversations (admin sees all)
  const loadConversations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`${getApiUrl()}/chat/conversations`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to load conversations:", response.status);
        return;
      }

      const data = await response.json();
      const enriched = (data.conversations || []).map((conv: Conversation) => ({
        ...conv,
        unreadCount: data.enriched?.[conv.id]?.unreadCount || 0,
        lastMessage: data.enriched?.[conv.id]?.lastMessage,
        lastMessageIsFromMe: data.enriched?.[conv.id]?.lastMessageIsFromMe,
      }));

      setConversations(enriched);
    } catch (err) {
      console.error("Load conversations error:", err);
    }
  };

  // Load messages for conversation
  const loadMessages = async (conversationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(
        `${getApiUrl()}/chat/messages/${conversationId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        console.error("Failed to load messages:", response.status);
        return;
      }

      const data = await response.json();
      setMessages(data.messages || []);

      // Join socket room
      if (socket) {
        socket.emit("join_conversation", { conversationId });
      }
    } catch (err) {
      console.error("Load messages error:", err);
    }
  };

  // Select user and open/create conversation
  const handleSelectUser = async (user: User) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      // Create or get existing conversation
      const response = await fetch(`${getApiUrl()}/chat/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        console.error("Failed to create conversation:", response.status);
        return;
      }

      const data = await response.json();
      const conversationId = data.conversation.id;

      setSelectedConversationId(conversationId);
      setSelectedUserEmail(user.email);
      await loadMessages(conversationId);
    } catch (err) {
      console.error("Select user error:", err);
      setError(String(err));
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversationId) return;

    const receiverId = conversations.find(
      (c) => c.id === selectedConversationId
    )?.user_id;
    if (!receiverId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`${getApiUrl()}/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          receiverId,
          message: messageInput,
        }),
      });

      if (!response.ok) {
        console.error("Failed to send message:", response.status);
        return;
      }

      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);
      setMessageInput("");
    } catch (err) {
      console.error("Send message error:", err);
      setError(String(err));
    }
  };

  // Mark message as delivered
  const markMessageAsDelivered = async (messageId: string) => {
    if (!messageId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`${getApiUrl()}/chat/messages/${messageId}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.warn("Mark as delivered failed:", response.status);
      }
    } catch (err) {
      console.warn("Mark as delivered error:", err);
    }
  };

  // Filter users by search
  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading admin dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <p className="text-lg text-red-700">{error}</p>
          <a href="/" className="text-primary underline hover:text-primary/90 inline-block mt-4">
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT PANEL: User List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-blue-50">
          <h1 className="font-bold text-lg mb-4">Admin Panel</h1>
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No users found
              </div>
            ) : (
              filteredUsers.map((user) => {
                const userConv = conversations.find((c) => c.user_id === user.id);
                const hasMessages = userConv?.lastMessage ? true : false;
                
                return (
                  <div
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`p-3 rounded-lg cursor-pointer transition border-l-4 ${
                      selectedUserEmail === user.email
                        ? "bg-blue-500 text-white border-l-blue-600"
                        : "hover:bg-gray-100 border-l-gray-200 hover:border-l-blue-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {user.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">
                            {user.email}
                          </p>
                          {hasMessages && (
                            <span className={`text-xs px-2 py-1 rounded font-semibold whitespace-nowrap ${
                              selectedUserEmail === user.email
                                ? 'bg-blue-600 text-white'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              Active
                            </span>
                          )}
                        </div>
                        <p className={`text-xs ${
                          selectedUserEmail === user.email
                            ? 'opacity-70'
                            : 'opacity-70 text-gray-600'
                        }`}>
                          {new Date(user.created_at).toLocaleDateString()}
                        </p>
                        {userConv?.lastMessage && (
                          <p className={`text-xs truncate mt-1 ${
                            selectedUserEmail === user.email
                              ? 'opacity-80'
                              : 'text-gray-500'
                          }`}>
                            {userConv.lastMessageIsFromMe ? '📤 ' : '📥 '}{userConv.lastMessage}
                          </p>
                        )}
                      </div>
                      {userConv?.unreadCount ? (
                        <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                          {userConv.unreadCount}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Chat */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-semibold">{selectedUserEmail}</p>
                  <p className="text-sm text-gray-600">1-to-1 chat</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_id === currentUser?.id
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.sender_id === currentUser?.id
                          ? "bg-blue-500 text-white rounded-br-none"
                          : "bg-gray-100 text-gray-900 rounded-bl-none"
                      }`}
                    >
                      <p className="text-sm">{msg.message_text}</p>
                      <div
                        className={`text-xs mt-1 flex items-center gap-1 ${
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
                ))}
                <div ref={scrollRef} />
              </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={!selectedConversationId}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!selectedConversationId || !messageInput.trim()}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Select a user to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

