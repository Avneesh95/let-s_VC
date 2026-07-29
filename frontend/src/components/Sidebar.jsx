function FriendAction({ user, onAddFriend, onAcceptRequest, onRejectRequest }) {
  if (user.friendStatus === "friends") {
    return <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ Friend</span>;
  }

  if (user.friendStatus === "request-sent") {
    return <span className="text-xs text-gray-400 whitespace-nowrap">Requested</span>;
  }

  if (user.friendStatus === "request-received") {
    return (
      <div className="flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAcceptRequest(user.requestId);
          }}
          className="text-xs bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1"
          title="Accept"
        >
          ✓
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRejectRequest(user.requestId);
          }}
          className="text-xs bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1"
          title="Decline"
        >
          ✕
        </button>
      </div>
    );
  }

  // friendStatus === "none"
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onAddFriend(user._id);
      }}
      className="text-xs bg-brand hover:bg-brand-dark text-white rounded px-2 py-1 whitespace-nowrap"
    >
      + Add
    </button>
  );
}

export default function Sidebar({
  users,
  activeUser,
  onSelect,
  onlineUsers,
  currentUser,
  onLogout,
  onAddFriend,
  onAcceptRequest,
  onRejectRequest,
}) {
  const userList = Array.isArray(users) ? users : [];

  return (
    <aside className="w-full md:w-[300px] bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 font-semibold">
        <span>{currentUser.username}</span>
        <button
          onClick={onLogout}
          className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-gray-100"
        >
          Log out
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {userList.map((u) => (
          <li
            key={u._id}
            onClick={() => onSelect(u)}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-100 ${
              activeUser?._id === u._id ? "bg-gray-100" : ""
            }`}
          >
            <span
              className="w-10 h-10 rounded-full text-white font-semibold flex items-center justify-center shrink-0"
              style={{ backgroundColor: u.avatarColor }}
            >
              {u.username[0].toUpperCase()}
            </span>
            <span className="flex flex-col min-w-0 flex-1">
              <span className="font-medium truncate">{u.username}</span>
              <span
                className={`text-xs ${
                  onlineUsers.includes(u._id) ? "text-green-600" : "text-gray-400"
                }`}
              >
                {onlineUsers.includes(u._id) ? "Online" : "Offline"}
              </span>
            </span>
            <FriendAction
              user={u}
              onAddFriend={onAddFriend}
              onAcceptRequest={onAcceptRequest}
              onRejectRequest={onRejectRequest}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}
