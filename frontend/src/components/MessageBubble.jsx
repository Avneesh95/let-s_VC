export default function MessageBubble({ message, isOwn }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`bubble-row ${isOwn ? "own" : ""}`}>
      <div className={`bubble ${isOwn ? "own" : "other"} ${message.type === "image" ? "image-bubble" : ""}`}>
        {message.type === "image" ? (
          <img src={message.mediaUrl} alt="shared" className="shared-image" />
        ) : (
          <p>{message.text}</p>
        )}
        <span className="bubble-time">{time}</span>
      </div>
    </div>
  );
}
