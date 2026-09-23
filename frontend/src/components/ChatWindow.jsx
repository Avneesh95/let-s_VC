import { useEffect, useRef, useState, useMemo } from "react";
import { ArrowLeft, Video, MessageSquareText, ChevronDown, Sparkles, ShieldCheck } from "lucide-react";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import Avatar from "./Avatar";

function formatDateDivider(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

export default function ChatWindow({
  activeUser,
  messages = [],
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
  const scrollContainerRef = useRef(null);
  const bottomRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Group messages by day
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDay = null;
    let currentList = [];

    messages.forEach((msg) => {
      const day = formatDateDivider(msg.createdAt);
      if (day !== currentDay) {
        if (currentList.length > 0) {
          groups.push({ day: currentDay, messages: currentList });
        }
        currentDay = day;
        currentList = [msg];
      } else {
        currentList.push(msg);
      }
    });

    if (currentList.length > 0) {
      groups.push({ day: currentDay, messages: currentList });
    }

    return groups;
  }, [messages]);

  // Scroll to bottom when messages or typing changes
  useEffect(() => {
    if (!showScrollBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOtherTyping, showScrollBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [activeUser?._id]);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 220;
    setShowScrollBottom(isUp);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBottom(false);
  };

  if (!activeUser) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-4 bg-chatbg/50 text-ink/60 p-8 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-brand-gradient/10 border border-brand/20 flex items-center justify-center text-brand shadow-sm">
          <MessageSquareText className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div className="max-w-xs flex flex-col gap-1">
          <h3 className="font-display font-semibold text-lg text-ink">Your Conversations</h3>
          <p className="text-xs text-ink/50 leading-relaxed">
            Select a friend from the sidebar to chat, share photos, and start encrypted video calls.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-ink/5 text-ink/60 border border-line/10 mt-2">
          <ShieldCheck className="w-3.5 h-3.5 text-brand" />
          <span>Peer-to-peer Mesh Calling</span>
        </div>
      </div>
    );
  }

  const isFriend = activeUser.friendStatus === "friends";
  const canCall = isFriend && isUserOnline;
  const callTitle = !isFriend
    ? "Add as friend to enable video calls"
    : isUserOnline
    ? "Start HD video call"
    : "User is currently offline";

  return (
    <div className="flex-1 flex flex-col bg-chatbg w-full min-h-0 relative">
      {/* Chat Header */}
      <div className="flex items-center justify-between gap-3 bg-surface/90 backdrop-blur-md px-4 py-3 border-b border-line/15 font-medium shadow-sm z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            aria-label="Back to contacts list"
            className="md:hidden w-8 h-8 -ml-1.5 flex items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          </button>

          <span className="relative shrink-0">
            <Avatar user={activeUser} size="w-10 h-10" />
            {isUserOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-surface animate-pulse" />
            )}
          </span>

          <div className="flex flex-col min-w-0">
            <span className="truncate font-display font-bold text-sm sm:text-base text-ink leading-tight">
              {activeUser.username}
            </span>
            <span className="text-[11px] text-ink/50 font-medium flex items-center gap-1.5 leading-none mt-0.5">
              {isUserOnline ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Online
                </span>
              ) : (
                <span>Offline</span>
              )}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onStartCall}
            disabled={!canCall}
            title={callTitle}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
              canCall
                ? "bg-brand/10 hover:bg-brand/20 active:scale-95 text-brand dark:text-brand-light shadow-sm"
                : "opacity-35 cursor-not-allowed text-ink/40"
            }`}
          >
            <Video className="w-4.5 h-4.5 sm:w-5 sm:h-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto thin-scrollbar px-3 sm:px-5 py-4 flex flex-col justify-start"
      >
        {groupedMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-ink/40 gap-2 select-none">
            <span className="w-12 h-12 rounded-2xl bg-ink/5 flex items-center justify-center text-ink/25">
              <Sparkles className="w-6 h-6" />
            </span>
            <p className="text-xs sm:text-sm font-medium">Say hello to {activeUser.username}!</p>
            <p className="text-[11px] text-ink/35 max-w-xs">
              This is the beginning of your direct conversation.
            </p>
          </div>
        ) : (
          groupedMessages.map((group, groupIdx) => (
            <div key={groupIdx} className="w-full">
              {group.day && (
                <div className="flex items-center justify-center my-3 select-none">
                  <span className="px-3 py-1 rounded-full bg-surface/80 dark:bg-surface/60 border border-line/15 text-[11px] font-semibold text-ink/50 shadow-xs backdrop-blur-sm">
                    {group.day}
                  </span>
                </div>
              )}
              {group.messages.map((m) => (
                <MessageBubble
                  key={m._id}
                  message={m}
                  isOwn={m.sender === currentUserId}
                  onReact={onReact}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          ))
        )}

        {/* Modern Animated Typing Indicator */}
        {isOtherTyping && (
          <div className="flex items-center gap-2 mb-3 animate-fade-in-up">
            <Avatar user={activeUser} size="w-6 h-6" />
            <div className="bg-surface border border-line/15 rounded-2xl rounded-bl-xs px-3.5 py-2.5 shadow-xs flex items-center gap-1">
              <span className="typing-dot bg-brand" />
              <span className="typing-dot bg-brand" />
              <span className="typing-dot bg-brand" />
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          className="absolute right-4 bottom-20 z-20 w-9 h-9 rounded-full bg-surface/95 border border-line/20 shadow-premium-lg text-ink flex items-center justify-center hover:bg-paper active:scale-95 transition-all animate-scale-in"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Footer Message Input or Friend Gating Notification */}
      {isFriend ? (
        <MessageInput
          onSend={onSend}
          onSendImage={onSendImage}
          onTyping={onTyping}
          onStopTyping={onStopTyping}
        />
      ) : (
        <div className="bg-surface border-t border-line/15 px-4 py-4 text-center text-xs sm:text-sm text-ink/65 font-medium flex items-center justify-center gap-2">
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
