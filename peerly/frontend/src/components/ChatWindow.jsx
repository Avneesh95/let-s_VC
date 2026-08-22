import { useEffect, useRef } from "react";
import { ArrowLeft, Video, MessageSquareText } from "lucide-react";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import Avatar from "./Avatar";

export default function ChatWindow({
  activeUser,
  messages,
  currentUserId,
  onSend,
  onSendImage,
  onReact,
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
      <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 bg-chatbg text-ink/60">
        <span className="w-14 h-14 rounded-full bg-ink/5 flex items-center justify-center">
          <MessageSquareText className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <p className="text-sm">Select a contact to start chatting</p>
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
      <div className="flex items-center gap-3 bg-surface px-4 py-3 border-b border-line/10 font-semibold shadow-sm shadow-black/[0.02] z-10">
        <button
          onClick={onBack}
          aria-label="Back to contacts"
          className="md:hidden w-8 h-8 -ml-1 flex items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <span className="relative shrink-0">
          <Avatar user={activeUser} />
          {isUserOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-neon shadow-neon ring-2 ring-surface" />
          )}
        </span>
        <span className="flex-1 truncate font-display text-ink">{activeUser.username}</span>
        <button
          onClick={onStartCall}
          disabled={!canCall}
          title={callTitle}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            canCall ? "bg-brand/10 hover:bg-brand/20 text-brand dark:text-brand-light" : "opacity-30 cursor-not-allowed text-ink/50"
          }`}
        >
          <Video className="w-4.5 h-4.5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar p-4 flex flex-col">
        {messages.map((m) => (
          <MessageBubble key={m._id} message={m} isOwn={m.sender === currentUserId} onReact={onReact} currentUserId={currentUserId} />
        ))}
        {isOtherTyping && (
          <div className="text-sm text-ink/60 italic py-1">{activeUser.username} is typing…</div>
        )}
        <div ref={bottomRef} />
      </div>

      {isFriend ? (
        <MessageInput onSend={onSend} onSendImage={onSendImage} onTyping={onTyping} onStopTyping={onStopTyping} />
      ) : (
        <div className="bg-surface border-t border-line/10 px-4 py-4 text-center text-sm text-ink/60">
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
