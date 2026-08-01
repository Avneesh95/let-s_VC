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
      <div className="hidden md:flex flex-1 items-center justify-center bg-chatbg text-ink/50">
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
      <div className="flex items-center gap-3 bg-white px-4 py-3 border-b border-black/5 font-semibold">
        <button onClick={onBack} aria-label="Back to contacts" className="md:hidden text-xl px-1">
          ←
        </button>
        <span
          className="w-10 h-10 rounded-full text-white font-semibold flex items-center justify-center shrink-0"
          style={{ backgroundColor: activeUser.avatarColor }}
        >
          {activeUser.username[0].toUpperCase()}
        </span>
        <span className="flex-1 truncate font-display text-ink">{activeUser.username}</span>
        <button
          onClick={onStartCall}
          disabled={!canCall}
          title={callTitle}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            canCall ? "bg-brand/10 hover:bg-brand/20 text-brand" : "opacity-30 cursor-not-allowed"
          }`}
        >
          📹
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {messages.map((m) => (
          <MessageBubble key={m._id} message={m} isOwn={m.sender === currentUserId} />
        ))}
        {isOtherTyping && (
          <div className="text-sm text-ink/50 italic py-1">{activeUser.username} is typing…</div>
        )}
        <div ref={bottomRef} />
      </div>

      {isFriend ? (
        <MessageInput onSend={onSend} onSendImage={onSendImage} onTyping={onTyping} onStopTyping={onStopTyping} />
      ) : (
        <div className="bg-white border-t border-black/5 px-4 py-4 text-center text-sm text-ink/50">
          {activeUser.friendStatus === "request-sent"
            ? `Friend request sent — you can chat once ${activeUser.username} accepts.`
            : activeUser.friendStatus === "request-received"
            ? `Accept ${activeUser.username}'s friend request in the sidebar to start chatting.`
            : `Add ${activeUser.username} as a friend to start chatting.`}
        </div>
      )}
    </div>
  );
}
