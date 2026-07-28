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
      e.target.value = ""; // allow selecting the same file again later
    }
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
      <button
        type="button"
        className="attach-btn"
        onClick={() => fileInputRef.current.click()}
        disabled={uploading}
        title="Send image"
      >
        {uploading ? "…" : "📎"}
      </button>
      <input
        type="text"
        placeholder="Type a message..."
        value={text}
        onChange={handleChange}
      />
      <button type="submit">Send</button>
    </form>
  );
}
