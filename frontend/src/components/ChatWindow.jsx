import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

export default function ChatWindow({
  activeUser,
  messages,
  currentUserId,
  onSend,
  onSendImage,
  onTyping,
  onStopTyping,
  isOtherTyping,
  onStartCall,
  isUserOnline,
  onBack,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOtherTyping]);

  if (!activeUser) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-chatbg text-gray-500">
        <p>Select a contact to start chatting</p>
      </div>
    );
  }

  const isFriend = activeUser.friendStatus === "friends";
  const canCall = isFriend && isUserOnline;
  const callTitle = !isFriend
    ? "Add as friend to enable calls"
    : isUserOnline
    ? "Start video call"
    : "User is offline";

  return (
    <div className="flex-1 flex flex-col bg-chatbg w-full">
      <div className="flex items-center gap-3 bg-white px-4 py-3 border-b border-gray-200 font-semibold">
        <button onClick={onBack} aria-label="Back to contacts" className="md:hidden text-xl px-1">
          ←
        </button>
        <span
          className="w-10 h-10 rounded-full text-white font-semibold flex items-center justify-center shrink-0"
          style={{ backgroundColor: activeUser.avatarColor }}
        >
          {activeUser.username[0].toUpperCase()}
        </span>
        <span className="flex-1 truncate">{activeUser.username}</span>
        <button
          onClick={onStartCall}
          disabled={!canCall}
          title={callTitle}
          className={`text-xl ${canCall ? "opacity-100" : "opacity-30 cursor-not-allowed"}`}
        >
          📹
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {messages.map((m) => (
          <MessageBubble key={m._id} message={m} isOwn={m.sender === currentUserId} />
        ))}
        {isOtherTyping && (
          <div className="text-sm text-gray-500 italic py-1">{activeUser.username} is typing…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={onSend} onSendImage={onSendImage} onTyping={onTyping} onStopTyping={onStopTyping} />
    </div>
  );
}
