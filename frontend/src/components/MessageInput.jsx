import { useEffect, useRef, useState } from "react";
import { Paperclip, SendHorizonal, Loader2 } from "lucide-react";
import api from "../api/axios";

// Caps how tall the box can grow before it starts scrolling internally
// instead — roughly 6 lines, matching WhatsApp's input behavior.
const MAX_HEIGHT_PX = 128;

export default function MessageInput({ onSend, onSendImage, onTyping, onStopTyping }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-grow to fit the content, capped at MAX_HEIGHT_PX (then it scrolls
  // internally). Previously this was a plain single-line <input> — a
  // multi-line message just scrolled its own text sideways/invisibly
  // inside a fixed-height box instead of the box growing to show it.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto"; // shrink first so deleting text also shrinks the box back down
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  const handleChange = (e) => {
    setText(e.target.value);
    onTyping();

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      onStopTyping();
    }, 1200);
  };

  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
    onStopTyping();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  // Enter sends, Shift+Enter inserts a newline — same convention as
  // WhatsApp Web/Slack/etc. On mobile, virtual keyboards (Gboard, Samsung
  // Keyboard, etc.) route word-suggestion/autocomplete acceptance through
  // the same "Enter" keydown while text is still mid-composition
  // (e.isComposing / keyCode 229). Without the isComposing guard, tapping
  // a suggested word — which fires Enter internally — sent the message
  // early instead of just accepting the suggestion. This was the core of
  // the "text box doesn't work well on phone" bug.
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSendImage(data.url);
    } catch (err) {
      alert("Image upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 bg-surface px-3 py-2.5 border-t border-line/10"
      style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
    >
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current.click()}
        disabled={uploading}
        title="Send image"
        className="w-9 h-9 shrink-0 mb-0.5 rounded-full flex items-center justify-center text-ink/45 hover:text-ink hover:bg-ink/5 disabled:opacity-50 transition-colors"
      >
        {uploading ? <Loader2 className="w-4.5 h-4.5 animate-spin" strokeWidth={1.75} /> : <Paperclip className="w-4.5 h-4.5" strokeWidth={1.75} />}
      </button>
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder="Type a message..."
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        // text-base (16px) is deliberate, not a style nitpick: any
        // input/textarea under 16px font-size makes iOS Safari
        // auto-zoom the whole page on focus, which is exactly what
        // "phone text box behaves badly" looks like from the outside —
        // the viewport jumps and stays zoomed until the user manually
        // pinches back out. Shrinks back to text-sm on desktop where
        // that bug doesn't exist.
        className="flex-1 resize-none border border-line/15 bg-paper/50 rounded-[1.35rem] px-4 py-2.25 text-base md:text-sm leading-normal max-h-32 overflow-y-auto thin-scrollbar focus:outline-none focus:ring-2 focus:ring-brand/35 focus:border-brand transition-shadow"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        aria-label="Send message"
        className="w-9 h-9 shrink-0 mb-0.5 rounded-full bg-brand-gradient hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-neon-brand transition-all"
      >
        <SendHorizonal className="w-4 h-4" strokeWidth={2} />
      </button>
    </form>
  );
}
