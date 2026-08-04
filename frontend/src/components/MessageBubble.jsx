import { useState } from "react";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function MessageBubble({ message, isOwn, onReact, currentUserId }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const reactions = message.reactions || [];
  // Group by emoji so multiple people reacting the same way show as one
  // pill with a count, rather than duplicate pills.
  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || [];
    acc[r.emoji].push(r.user);
    return acc;
  }, {});
  const myReaction = reactions.find((r) => r.user === currentUserId)?.emoji;

  const handlePick = (emoji) => {
    onReact?.(message._id, emoji);
    setPickerOpen(false);
  };

  return (
    <div className={`flex mb-4 ${isOwn ? "justify-end" : "justify-start"} group relative`}>
      <div className={`flex items-end gap-1 ${isOwn ? "flex-row-reverse" : ""}`}>
        <div
          className={`max-w-[78%] md:max-w-[60%] rounded-lg px-3 py-2 relative ${
            isOwn ? "bg-bubbleOwn" : "bg-surface"
          } ${message.type === "image" ? "p-1" : ""}`}
        >
          {message.type === "image" ? (
            <img src={message.mediaUrl} alt="shared" className="max-w-[240px] max-h-[240px] rounded-md block" />
          ) : (
            <p className="text-sm break-words">{message.text}</p>
          )}
          <span className="block text-[10px] text-ink/30 text-right mt-0.5">{time}</span>

          {Object.keys(grouped).length > 0 && (
            <div className={`absolute -bottom-3 ${isOwn ? "right-2" : "left-2"} flex gap-1`}>
              {Object.entries(grouped).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => handlePick(emoji)}
                  className={`text-xs rounded-full px-1.5 py-0.5 border shadow-sm ${
                    myReaction === emoji
                      ? "bg-brand/10 border-brand"
                      : "bg-surface border-line/15"
                  }`}
                >
                  {emoji} {users.length > 1 && users.length}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* React button — appears on hover (desktop) so it doesn't clutter
            every message by default */}
        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="text-xs w-6 h-6 rounded-full hover:bg-ink/5 flex items-center justify-center"
            title="React"
          >
            🙂
          </button>
          {pickerOpen && (
            <div
              className={`absolute z-10 bottom-7 ${
                isOwn ? "right-0" : "left-0"
              } bg-surface border border-line/10 rounded-full shadow-md px-2 py-1 flex gap-1`}
            >
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handlePick(emoji)}
                  className="text-base hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
