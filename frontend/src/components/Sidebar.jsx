import { useState } from "react";
import { useNavigate } from "react-router-dom";
import generateRoomCode from "../utils/generateRoomCode";

function FriendAction({ user, onAddFriend, onAcceptRequest, onRejectRequest }) {
  if (user.friendStatus === "friends") {
    return <span className="text-xs text-brand font-medium whitespace-nowrap">✓ Friend</span>;
  }

  if (user.friendStatus === "request-sent") {
    return <span className="text-xs text-ink/30 whitespace-nowrap">Requested</span>;
  }

  if (user.friendStatus === "request-received") {
    return (
      <div className="flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAcceptRequest(user.requestId);
          }}
          className="text-xs bg-brand hover:bg-brand-dark transition-colors text-white rounded px-2 py-1"
          title="Accept"
        >
          ✓
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRejectRequest(user.requestId);
          }}
          className="text-xs bg-danger hover:opacity-90 transition-opacity text-white rounded px-2 py-1"
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
      className="text-xs bg-brand hover:bg-brand-dark transition-colors text-white rounded px-2 py-1 whitespace-nowrap"
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
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");

  const startGroupCall = () => {
    const code = generateRoomCode();
    navigate(`/room/${code}`);
  };

  const joinGroupCall = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    navigate(`/room/${joinCode.trim().toUpperCase()}`);
  };

  return (
    <aside className="w-full md:w-[300px] bg-white border-r border-black/5 flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <span className="font-display font-semibold text-ink">
          chat<span className="text-brand">/</span>app
        </span>
        <button
          onClick={onLogout}
          className="text-xs border border-black/10 rounded px-2 py-1 hover:bg-paper transition-colors"
        >
          Log out
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/5">
        <span
          className="w-8 h-8 rounded-full text-white text-sm font-semibold flex items-center justify-center shrink-0"
          style={{ backgroundColor: currentUser.avatarColor || "#1F6F5C" }}
        >
          {currentUser.username[0].toUpperCase()}
        </span>
        <span className="text-sm font-medium text-ink truncate">{currentUser.username}</span>
      </div>

      <div className="px-4 py-3 border-b border-black/5 flex flex-col gap-2 bg-paper/60">
        <button
          onClick={startGroupCall}
          className="text-sm bg-brand hover:bg-brand-dark transition-colors text-white font-semibold rounded-lg py-2"
        >
          🎥 New Group Call
        </button>
        <form onSubmit={joinGroupCall} className="flex gap-2">
          <input
            type="text"
            placeholder="Enter room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="flex-1 min-w-0 border border-black/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 uppercase bg-white"
            maxLength={6}
          />
          <button
            type="submit"
            className="text-sm border border-black/10 rounded-lg px-3 py-1.5 hover:bg-white transition-colors bg-white"
          >
            Join
          </button>
        </form>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {userList.map((u) => (
          <li
            key={u._id}
            onClick={() => onSelect(u)}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-paper transition-colors ${
              activeUser?._id === u._id ? "bg-paper" : ""
            }`}
          >
            <span
              className="w-10 h-10 rounded-full text-white font-semibold flex items-center justify-center shrink-0"
              style={{ backgroundColor: u.avatarColor }}
            >
              {u.username[0].toUpperCase()}
            </span>
            <span className="flex flex-col min-w-0 flex-1">
              <span className="font-medium text-ink truncate">{u.username}</span>
              <span
                className={`text-xs ${onlineUsers.includes(u._id) ? "text-brand" : "text-ink/30"}`}
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
