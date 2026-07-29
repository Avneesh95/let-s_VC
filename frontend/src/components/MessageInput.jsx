import { useRef, useState } from "react";
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-white px-3 py-2 border-t border-gray-200">
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
        className="text-xl px-1 disabled:opacity-50"
      >
        {uploading ? "…" : "📎"}
      </button>
      <input
        type="text"
        placeholder="Type a message..."
        value={text}
        onChange={handleChange}
        className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <button
        type="submit"
        className="bg-brand hover:bg-brand-dark text-white font-semibold rounded-full px-5 py-2 text-sm"
      >
        Send
      </button>
    </form>
  );
}
