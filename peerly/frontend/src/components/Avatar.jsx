export default function Avatar({ user, size = "w-10 h-10", className = "" }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.username}
        className={`${size} rounded-full object-cover shrink-0 ring-1 ring-line/10 ${className}`}
      />
    );
  }

  const color = user.avatarColor || "#F4600F";

  return (
    <span
      className={`${size} rounded-full text-white font-display font-semibold flex items-center justify-center shrink-0 ring-1 ring-white/15 relative overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(150deg, ${color} 0%, rgba(0,0,0,0.35) 140%)`,
      }}
    >
      <span className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent" />
      <span className="relative">{user.username[0].toUpperCase()}</span>
    </span>
  );
}
