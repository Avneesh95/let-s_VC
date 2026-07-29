export default function MessageBubble({ message, isOwn }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex mb-2 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] md:max-w-[60%] rounded-lg px-3 py-2 ${
          isOwn ? "bg-bubbleOwn" : "bg-white"
        } ${message.type === "image" ? "p-1" : ""}`}
      >
        {message.type === "image" ? (
          <img src={message.mediaUrl} alt="shared" className="max-w-[240px] max-h-[240px] rounded-md block" />
        ) : (
          <p className="text-sm break-words">{message.text}</p>
        )}
        <span className="block text-[10px] text-gray-400 text-right mt-0.5">{time}</span>
      </div>
    </div>
  );
}
