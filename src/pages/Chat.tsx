import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import "../App.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const socket = io(SOCKET_URL);

export default function Chat({ userName = "User" }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // JOIN ROOM (MANDATORY)
    socket.emit("join_room", {
      loanId: 1,
      user: userName,
    });

    // RECEIVE MESSAGE
    socket.on("receive_message", (data) => {
      setMessages((prev) => [
        ...prev,
        {
          user: data.name,
          text: data.message,
          timestamp: data.time,
        },
      ]);
    });

    return () => {
      socket.off("receive_message");
    };
  }, [userName]);

  const sendMessage = () => {
    if (!input.trim()) return;

    socket.emit("send_message", {
      loanId: 1,
      sender: userName,
      name: userName,
      message: input,
      time: Date.now(),
    });

    setInput("");
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Loan Chat System</h2>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-message ${
              msg.user === userName ? "own" : ""
            }`}
          >
            <span className="chat-user">{msg.user}:</span>
            <span className="chat-text">{msg.text}</span>
            <span className="chat-time">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
        <div ref={scrollRef}></div>
      </div>

      <div className="chat-input">
        <input
          type="text"
          className="chat-input-field"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button className="chat-send-btn" onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}
