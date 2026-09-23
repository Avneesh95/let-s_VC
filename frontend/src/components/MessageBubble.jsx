import { useState, useEffect } from "react";
import { Smile, Download, X, Loader2, ZoomIn, CheckCheck } from "lucide-react";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

async function downloadImage(url) {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `peerly-image-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function ImageLightbox({ url, onClose }) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    await downloadImage(url);
    setDownloading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in-up select-none"
      onClick={onClose}
    >
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/60 to-transparent z-10">
        <span className="text-xs sm:text-sm font-medium text-white/70">Image Preview</span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            disabled={downloading}
            title="Download image"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-60 flex items-center justify-center text-white transition-all shadow-md"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" strokeWidth={2} />}
          </button>
          <button
            onClick={onClose}
            title="Close preview (Esc)"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all shadow-md"
          >
            <X className="w-4.5 h-4.5" strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="relative max-w-full max-h-[88vh] flex items-center justify-center">
        <img
          src={url}
          alt="Shared content preview"
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
        />
      </div>
    </div>
  );
}

export default function MessageBubble({ message, isOwn, onReact, currentUserId }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const parsedDate = new Date(message.createdAt);
  const time = Number.isNaN(parsedDate.getTime())
    ? ""
    : parsedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const reactions = message.reactions || [];
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

  const hasReactions = Object.keys(grouped).length > 0;

  return (
    <div
      className={`flex ${hasReactions ? "mb-6.5" : "mb-3"} ${
        isOwn ? "justify-end" : "justify-start"
      } group relative animate-fade-in-up w-full`}
    >
      <div
        className={`flex items-end gap-1.5 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] min-w-0 ${
          isOwn ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Main Bubble Container */}
        <div
          className={`relative min-w-[75px] max-w-full rounded-2xl px-3.5 py-2.5 shadow-sm transition-shadow ${
            isOwn
              ? "bg-gradient-to-br from-[#F4600F]/15 via-[#F4600F]/10 to-[#FFA733]/15 dark:from-[#F4600F]/25 dark:to-[#FFA733]/15 text-ink rounded-br-xs border border-brand/20 shadow-orange-500/5"
              : "bg-surface text-ink rounded-bl-xs border border-line/15 shadow-black/[0.03]"
          } ${message.type === "image" ? "!p-1.5 !pb-1" : ""}`}
        >
          {message.type === "image" ? (
            <div className="relative group/img overflow-hidden rounded-xl bg-black/5 dark:bg-white/5">
              {!imageLoaded && (
                <div className="w-[240px] h-[180px] sm:w-[280px] sm:h-[200px] flex items-center justify-center bg-ink/5 animate-pulse text-ink/30">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block relative max-w-full cursor-pointer focus:outline-none"
                title="Click to expand"
              >
                <img
                  src={message.mediaUrl}
                  alt="Shared media"
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                  className={`max-w-[240px] sm:max-w-[300px] max-h-[320px] w-auto h-auto rounded-xl object-cover transition-transform duration-300 group-hover/img:scale-[1.01] ${
                    !imageLoaded ? "hidden" : "block"
                  }`}
                />
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors rounded-xl flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                  <span className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center shadow-lg backdrop-blur-sm">
                    <ZoomIn className="w-4.5 h-4.5" />
                  </span>
                </div>
              </button>
            </div>
          ) : (
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words break-all break-anywhere select-text font-normal">
              {message.text}
            </p>
          )}

          {/* Time & Read Checkmark */}
          <div
            className={`flex items-center justify-end gap-1 mt-0.5 select-none ${
              message.type === "image" ? "px-1.5 pt-1 pb-0.5" : ""
            }`}
          >
            <span className="text-[10px] text-ink/45 font-medium tracking-tight">
              {time}
            </span>
            {isOwn && (
              <CheckCheck className="w-3 h-3 text-brand dark:text-brand-light opacity-80" />
            )}
          </div>

          {/* Reaction badges */}
          {hasReactions && (
            <div
              className={`absolute -bottom-3.5 ${
                isOwn ? "right-2" : "left-2"
              } flex flex-wrap gap-1 z-10`}
            >
              {Object.entries(grouped).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => handlePick(emoji)}
                  className={`text-[11px] font-medium rounded-full px-2 py-0.5 border shadow-sm flex items-center gap-1 transition-transform active:scale-95 ${
                    myReaction === emoji
                      ? "bg-brand/15 border-brand text-brand dark:text-brand-light ring-1 ring-brand/30"
                      : "bg-surface border-line/20 text-ink/80 hover:bg-paper"
                  }`}
                >
                  <span>{emoji}</span>
                  {users.length > 1 && <span className="text-[10px]">{users.length}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reaction trigger icon (Desktop hover + Mobile touch friendly) */}
        <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="w-7 h-7 rounded-full hover:bg-ink/5 active:scale-90 flex items-center justify-center text-ink/40 hover:text-ink/80 transition-all cursor-pointer"
            title="Add reaction"
          >
            <Smile className="w-4 h-4" strokeWidth={1.75} />
          </button>
          {pickerOpen && (
            <div
              className={`absolute z-30 bottom-8 ${
                isOwn ? "right-0" : "left-0"
              } bg-surface/95 backdrop-blur-md border border-line/15 rounded-full shadow-premium-lg px-2.5 py-1.5 flex items-center gap-1 animate-scale-in`}
            >
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handlePick(emoji)}
                  className="text-lg hover:scale-130 active:scale-95 transition-transform p-0.5 cursor-pointer"
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {message.type === "image" && lightboxOpen && (
        <ImageLightbox url={message.mediaUrl} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
