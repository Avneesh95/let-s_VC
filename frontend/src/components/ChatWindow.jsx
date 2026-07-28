import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

export default function ChatWindow({ activeUser, messages, currentUserId, onSend, onSendImage, onTyping, onStopTyping, isOtherTyping, onStartCall, isUserOnline }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOtherTyping]);

  if (!activeUser) {
    return (
      <div className="chat-window empty-state">
        <p>Select a contact to start chatting</p>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span className="avatar" style={{ backgroundColor: activeUser.avatarColor }}>
          {activeUser.username[0].toUpperCase()}
        </span>
        <span className="chat-header-name">{activeUser.username}</span>
        <button
          className="call-btn"
          onClick={onStartCall}
          disabled={!isUserOnline}
          title={isUserOnline ? "Start video call" : "User is offline"}
        >
          📹
        </button>
      </div>

      <div className="messages">
        {messages.map((m) => (
          <MessageBubble key={m._id} message={m} isOwn={m.sender === currentUserId} />
        ))}
        {isOtherTyping && <div className="typing-indicator">{activeUser.username} is typing…</div>}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={onSend} onSendImage={onSendImage} onTyping={onTyping} onStopTyping={onStopTyping} />
    </div>
  );
}
