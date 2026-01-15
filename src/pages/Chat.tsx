import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const socket = io(SOCKET_URL);

interface Message {
  user: string;
  text: string;
  timestamp: number;
  type?: "text" | "file";
  fileUrl?: string;
}

export default function Chat({ userName = "You" }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const STORAGE_KEY = "chat_messages_loan_1"; // Use unique key per loan

  // Load messages from storage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed);
      } catch (e) {
        console.error("Failed to load messages:", e);
      }
    }
  }, []);

  // Save messages to storage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    // Join loan room
    socket.emit("join_room", { loanId: 1, user: userName });

    // Request message history from server
    socket.emit("request_history", { loanId: 1 });

    // Listen for message history
    socket.on("message_history", (history: any[]) => {
      if (history && history.length > 0) {
        setMessages(history);
      }
    });

    socket.on("receive_message", (data: any) => {
      const newMessage = {
        user: data.name,
        text: data.message,
        timestamp: data.time,
        type: data.type || "text",
        fileUrl: data.fileUrl,
      };
      
      setMessages((prev) => {
        // Avoid duplicates by checking timestamp and user
        const isDuplicate = prev.some(
          msg => msg.timestamp === newMessage.timestamp && msg.user === newMessage.user
        );
        if (isDuplicate) return prev;
        return [...prev, newMessage];
      });
    });

    return () => {
      socket.off("receive_message");
      socket.off("message_history");
    };
  }, [userName]);

  const sendMessage = () => {
    if (!input.trim() && !file) return;

    let messageData: any = {
      loanId: 1,
      sender: userName,
      name: userName,
      message: input,
      time: Date.now(),
    };

    if (file) {
      messageData.type = "file";
      messageData.fileUrl = URL.createObjectURL(file);
    }

    socket.emit("send_message", messageData);
    
    // Add to local messages (will be saved to localStorage via useEffect)
    setMessages((prev) => [...prev, messageData]);
    setInput("");
    setFile(null);
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800">Loan #00124</h2>
          <p className="text-sm text-gray-600 mt-2">Client: John Doe</p>
          <p className="text-sm text-gray-600">Status: Under Review</p>
        </div>
        <div className="flex items-center gap-3 mt-8">
          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
            {userName[0]}
          </div>
          <span className="text-sm font-medium text-gray-700">{userName}</span>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">Communication Portal</h1>
          <p className="text-sm text-green-600 mt-1">● Live Session</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.user === userName ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-md rounded-lg p-4 ${
                    msg.user === userName
                      ? "bg-blue-500 text-white"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">{msg.user}</div>
                  {msg.type === "file" ? (
                    <a
                      href={msg.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      📄 {msg.text || "Document"}
                    </a>
                  ) : (
                    <div className="text-sm">{msg.text}</div>
                  )}
                  <div className="text-xs opacity-70 mt-2">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <button className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded">
              +
            </button>
            <input
              type="text"
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              Send Message
            </button>
          </div>
          {file && (
            <div className="mt-2 text-sm text-gray-600">
              Selected: {file.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}