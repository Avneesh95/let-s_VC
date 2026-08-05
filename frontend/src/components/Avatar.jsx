export default function Avatar({ user, size = "w-10 h-10", className = "" }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.username}
        className={`${size} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      className={`${size} rounded-full text-white font-semibold flex items-center justify-center shrink-0 ${className}`}
      style={{ backgroundColor: user.avatarColor || "#1F6F5C" }}
    >
      {user.username[0].toUpperCase()}
    </span>
  );
}
