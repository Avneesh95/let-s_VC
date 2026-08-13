import { useRef, useState } from "react";
import { Paperclip, SendHorizonal, Loader2 } from "lucide-react";
import api from "../api/axios";

export default function MessageInput({ onSend, onSendImage, onTyping, onStopTyping }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setText(e.target.value);
    onTyping();

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      onStopTyping();
    }, 1200);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
    onStopTyping();
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-surface px-3 py-2.5 border-t border-line/10">
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
        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-ink/45 hover:text-ink hover:bg-ink/5 disabled:opacity-50 transition-colors"
      >
        {uploading ? <Loader2 className="w-4.5 h-4.5 animate-spin" strokeWidth={1.75} /> : <Paperclip className="w-4.5 h-4.5" strokeWidth={1.75} />}
      </button>
      <input
        type="text"
        placeholder="Type a message..."
        value={text}
        onChange={handleChange}
        className="flex-1 border border-line/15 bg-paper/50 rounded-full px-4 py-2.25 text-sm focus:outline-none focus:ring-2 focus:ring-brand/35 focus:border-brand transition-shadow"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        aria-label="Send message"
        className="w-9 h-9 shrink-0 rounded-full bg-brand-gradient hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-neon-brand transition-all"
      >
        <SendHorizonal className="w-4 h-4" strokeWidth={2} />
      </button>
    </form>
  );
}
