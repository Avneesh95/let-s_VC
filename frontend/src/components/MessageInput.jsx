import { useEffect, useRef, useState } from "react";
import { Paperclip, SendHorizonal, Loader2, Smile, X, Image as ImageIcon } from "lucide-react";
import api from "../api/axios";

const MAX_HEIGHT_PX = 140;

const COMMON_EMOJIS = [
  "😊", "😂", "❤️", "👍", "🔥", "🎉", "🙌", "✨",
  "😎", "😍", "🤔", "🥺", "😭", "👏", "💯", "🙏",
  "🚀", "👀", "🥳", "🤩", "💪", "💡", "☕", "🍕"
];

export default function MessageInput({ onSend, onSendImage, onTyping, onStopTyping }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); // { file, previewUrl }
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiRef = useRef(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setEmojiPickerOpen(false);
      }
    };
    if (emojiPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [emojiPickerOpen]);

  // Clean up object URL when selectedImage changes
  useEffect(() => {
    return () => {
      if (selectedImage?.previewUrl) {
        URL.revokeObjectURL(selectedImage.previewUrl);
      }
    };
  }, [selectedImage]);

  // Auto-grow textarea to fit content up to MAX_HEIGHT_PX
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  const handleChange = (e) => {
    const nextText = e.target.value;
    setText(nextText);
    onTyping?.();

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      onStopTyping?.();
    }, 1200);
  };

  const handleSelectEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    onTyping?.();
    textareaRef.current?.focus();
  };

  const submit = async () => {
    if (uploading) return;

    // If an image is selected, upload it first
    if (selectedImage) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("image", selectedImage.file);
        const { data } = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        onSendImage(data.url);
        setSelectedImage(null);

        // If there's also text, send the text afterwards
        if (text.trim()) {
          onSend(text.trim());
          setText("");
        }
      } catch (err) {
        alert("Image upload failed. Please try again.");
      } finally {
        setUploading(false);
        onStopTyping?.();
      }
      return;
    }

    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
    onStopTyping?.();
    textareaRef.current?.focus();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verify file is an image and <= 10MB
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image size must be under 10MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedImage({ file, previewUrl });
    e.target.value = "";
    textareaRef.current?.focus();
  };

  const cancelSelectedImage = () => {
    if (selectedImage?.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }
    setSelectedImage(null);
  };

  const canSubmit = (text.trim().length > 0 || !!selectedImage) && !uploading;

  return (
    <div className="relative bg-surface border-t border-line/15 transition-colors">
      {/* Image Preview Draft Banner */}
      {selectedImage && (
        <div className="px-4 py-2.5 bg-paper/60 border-b border-line/10 flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-line/20 shrink-0 bg-black/10">
              <img
                src={selectedImage.previewUrl}
                alt="Selected preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink truncate max-w-[200px] sm:max-w-xs">
                {selectedImage.file.name}
              </p>
              <p className="text-[11px] text-ink/45">
                {(selectedImage.file.size / 1024).toFixed(1)} KB &bull; Ready to send
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={cancelSelectedImage}
            className="w-7 h-7 rounded-full bg-ink/10 hover:bg-ink/20 text-ink/70 flex items-center justify-center transition-colors"
            title="Cancel image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Input Form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 relative"
        style={{ paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))" }}
      >
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Attach photo"
          className="w-9 h-9 shrink-0 mb-0.5 rounded-xl flex items-center justify-center text-ink/45 hover:text-brand hover:bg-brand/10 disabled:opacity-40 transition-all cursor-pointer"
        >
          <Paperclip className="w-4.5 h-4.5" strokeWidth={1.8} />
        </button>

        {/* Emoji Button & Popover */}
        <div className="relative shrink-0 mb-0.5" ref={emojiRef}>
          <button
            type="button"
            onClick={() => setEmojiPickerOpen((v) => !v)}
            title="Choose emoji"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              emojiPickerOpen
                ? "text-brand bg-brand/10"
                : "text-ink/45 hover:text-brand hover:bg-brand/10"
            }`}
          >
            <Smile className="w-4.5 h-4.5" strokeWidth={1.8} />
          </button>

          {emojiPickerOpen && (
            <div className="absolute bottom-12 left-0 z-40 bg-surface/95 backdrop-blur-xl border border-line/15 rounded-2xl shadow-premium-lg p-3 w-64 animate-scale-in">
              <div className="text-[11px] font-semibold text-ink/45 uppercase tracking-wider mb-2 px-1">
                Quick Emojis
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelectEmoji(emoji)}
                    className="w-8 h-8 rounded-lg hover:bg-ink/5 flex items-center justify-center text-lg hover:scale-120 active:scale-95 transition-all cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Expandable Textarea */}
        <div className="flex-1 min-w-0 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={selectedImage ? "Add a caption… (optional)" : "Type a message…"}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            aria-label="Message"
            maxLength={4000}
            className="block w-full resize-none border border-line/20 bg-paper/70 dark:bg-paper/45 rounded-[1.15rem] px-3.5 py-2.5 text-[15px] sm:text-sm leading-6 max-h-36 overflow-y-auto thin-scrollbar focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/60 text-ink placeholder:text-ink/35 transition-all"
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!canSubmit}
          aria-label="Send message"
          className="w-10 h-10 shrink-0 mb-0.5 rounded-xl bg-brand-gradient hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center shadow-neon-brand transition-all cursor-pointer"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <SendHorizonal className="w-4 h-4 ml-0.5" strokeWidth={2} />
          )}
        </button>
      </form>
    </div>
  );
}
