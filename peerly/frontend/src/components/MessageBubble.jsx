import { useState } from "react";
import { Smile, Download, X, Loader2 } from "lucide-react";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Forces an actual save-to-device instead of just opening the image, which
// is what a plain `<a href download>` silently degrades to for a
// cross-origin URL (images here are served from Cloudinary, not the app's
// own origin — browsers ignore the `download` attribute across origins).
// Fetching the bytes ourselves and handing the browser a same-origin blob
// URL works everywhere, including "Save to Photos" on mobile browsers.
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
    // CORS or network hiccup — falling back to a plain new-tab open still
    // lets the person long-press/right-click to save it manually rather
    // than getting no feedback at all.
    window.open(url, "_blank", "noopener");
  }
}

// Full-screen viewer opened by tapping an image thumbnail — WhatsApp-style:
// tap to open large, explicit download action in the header, tap the
// backdrop or the X to close.
function ImageLightbox({ url, onClose }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    await downloadImage(url);
    setDownloading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute top-0 inset-x-0 flex items-center justify-end gap-2 p-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          disabled={downloading}
          title="Save image"
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-60 flex items-center justify-center text-white transition-colors"
        >
          {downloading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Download className="w-4.5 h-4.5" strokeWidth={1.75} />}
        </button>
        <button
          onClick={onClose}
          title="Close"
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>
      <img
        src={url}
        alt="shared"
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-sm select-none"
      />
    </div>
  );
}

export default function MessageBubble({ message, isOwn, onReact, currentUserId }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Guard against a missing/unparsable createdAt (e.g. a locally-built
  // message that hasn't round-tripped through the server yet) — without
  // this, toLocaleTimeString on an Invalid Date silently renders the
  // literal text "Invalid Date" in the bubble instead of a time.
  const parsedDate = new Date(message.createdAt);
  const time = Number.isNaN(parsedDate.getTime())
    ? ""
    : parsedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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

  const hasReactions = Object.keys(grouped).length > 0;

  return (
    // Reaction pills hang below the bubble via absolute positioning
    // (see "-bottom-3" below) — the default mb-4 gap isn't tall enough to
    // clear them, so they were visually overlapping the top of the next
    // message bubble. Widening the gap only when reactions are actually
    // present keeps normal messages tight.
    <div className={`flex ${hasReactions ? "mb-7" : "mb-4"} ${isOwn ? "justify-end" : "justify-start"} group relative`}>
      {/* min-w-0 on every level of this flex chain: a flex item's default
          min-width is "auto" (its content's natural size), not 0 — without
          overriding that, a wide image's intrinsic size could push this
          row wider than its max-w cap instead of being constrained by it,
          which is what was causing chat images to overflow the bubble. */}
      <div className={`flex items-end gap-1 min-w-0 max-w-full ${isOwn ? "flex-row-reverse" : ""}`}>
        <div
          className={`min-w-0 max-w-[78%] md:max-w-[60%] rounded-2xl px-3.5 py-2.5 relative shadow-sm ${
            isOwn
              ? "bg-bubbleOwn rounded-br-md ring-1 ring-brand/10"
              : "bg-surface rounded-bl-md ring-1 ring-line/5"
          } ${message.type === "image" ? "!p-1" : ""}`}
        >
          {message.type === "image" ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block max-w-full"
              title="Tap to view"
            >
              <img
                src={message.mediaUrl}
                alt="shared"
                loading="lazy"
                className="max-w-[260px] sm:max-w-[300px] max-h-[320px] w-auto h-auto rounded-lg block"
              />
            </button>
          ) : (
            <p className="text-sm break-words text-ink">{message.text}</p>
          )}
          <span className={`block text-[10px] text-ink/45 text-right mt-0.5 ${message.type === "image" ? "px-1.5 pb-0.5" : ""}`}>
            {time}
          </span>

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
        <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="w-6 h-6 rounded-full hover:bg-ink/5 flex items-center justify-center text-ink/40"
            title="React"
          >
            <Smile className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          {pickerOpen && (
            <div
              className={`absolute z-10 bottom-7 ${
                isOwn ? "right-0" : "left-0"
              } bg-surface border border-line/10 rounded-full shadow-premium px-2 py-1 flex gap-1`}
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

      {message.type === "image" && lightboxOpen && (
        <ImageLightbox url={message.mediaUrl} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
