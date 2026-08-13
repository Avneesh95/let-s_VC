import { useState } from "react";
import { useNavigate } from "react-router-dom";
import generateRoomCode from "../utils/generateRoomCode";
import ThemeToggle from "./ThemeToggle";
import Avatar from "./Avatar";
import SettingsModal from "./SettingsModal";
import Logo from "./Logo";

function FriendActionButton({ user, onAddFriend, onAcceptRequest, onRejectRequest }) {
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

// A chat row — a friend you can click straight into a conversation with.
function ChatRow({ u, isActive, onSelect }) {
  return (
    <li
      onClick={() => onSelect(u)}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-paper transition-colors ${
        isActive ? "bg-paper" : ""
      }`}
    >
      <Avatar user={u} />
      <span className="flex flex-col min-w-0 flex-1">
        <span className="font-medium text-ink truncate">{u.username}</span>
      </span>
    </li>
  );
}

// A person card in "Find People" — everyone, not just friends, since this
// is the discovery view. Clicking a card that's already a friend opens
// their chat; clicking anyone else is just the add/accept/reject actions.
function PersonCard({ u, onOpenChat, onAddFriend, onAcceptRequest, onRejectRequest }) {
  const clickable = u.friendStatus === "friends";
  return (
    <div
      onClick={() => clickable && onOpenChat(u)}
      className={`flex items-center gap-3 p-3 rounded-xl border border-line/10 bg-surface ${
        clickable ? "cursor-pointer hover:border-brand/40 hover:shadow-sm" : ""
      } transition-all`}
    >
      <Avatar user={u} size="w-11 h-11" />
      <span className="flex-1 min-w-0">
        <span className="font-medium text-ink truncate block">{u.username}</span>
      </span>
      <FriendActionButton
        user={u}
        onAddFriend={onAddFriend}
        onAcceptRequest={onAcceptRequest}
        onRejectRequest={onRejectRequest}
      />
    </div>
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
  const [tab, setTab] = useState("chats"); // "chats" | "find"
  const [settingsOpen, setSettingsOpen] = useState(false);

  const friends = userList.filter((u) => u.friendStatus === "friends");
  const pendingReceivedCount = userList.filter((u) => u.friendStatus === "request-received").length;

  const startGroupCall = () => {
    navigate(`/room/${generateRoomCode()}`);
  };

  const joinGroupCall = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    navigate(`/room/${joinCode.trim().toUpperCase()}`);
  };

  const openChatFromCard = (u) => {
    onSelect(u);
    setTab("chats");
  };

  return (
    <aside className="w-full md:w-[300px] bg-surface border-r border-line/10 flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-line/10 flex items-center justify-between">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={onLogout}
            className="text-xs border border-line/15 rounded px-2 py-1 hover:bg-paper transition-colors"
          >
            Log out
          </button>
        </div>
      </div>

      <button
        onClick={() => setSettingsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 border-b border-line/10 hover:bg-paper transition-colors text-left"
      >
        <Avatar user={currentUser} size="w-8 h-8" />
        <span className="text-sm font-medium text-ink truncate flex-1">{currentUser.username}</span>
        <span className="text-ink/30 text-sm" title="Settings">
          ⚙️
        </span>
      </button>

      <div className="px-4 py-3 border-b border-line/10 flex flex-col gap-2 bg-paper/60">
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
            className="flex-1 min-w-0 border border-line/15 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 uppercase bg-surface"
            maxLength={6}
          />
          <button
            type="submit"
            className="text-sm border border-line/15 rounded-lg px-3 py-1.5 hover:bg-surface transition-colors bg-surface"
          >
            Join
          </button>
        </form>
      </div>

      <div className="flex px-3 pt-3 gap-1">
        <button
          onClick={() => setTab("chats")}
          className={`flex-1 text-sm font-medium rounded-lg py-2 transition-colors ${
            tab === "chats" ? "bg-brand text-white" : "text-ink/50 hover:bg-paper"
          }`}
        >
          Chats
        </button>
        <button
          onClick={() => setTab("find")}
          className={`relative flex-1 text-sm font-medium rounded-lg py-2 transition-colors ${
            tab === "find" ? "bg-brand text-white" : "text-ink/50 hover:bg-paper"
          }`}
        >
          Find People
          {pendingReceivedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {pendingReceivedCount}
            </span>
          )}
        </button>
      </div>

      {tab === "chats" ? (
        friends.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2">
            <p className="text-sm text-ink/50">No friends yet.</p>
            <button
              onClick={() => setTab("find")}
              className="text-sm text-brand hover:underline font-medium"
            >
              Find people to chat with
            </button>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto py-1">
            {friends.map((u) => (
              <ChatRow key={u._id} u={u} isActive={activeUser?._id === u._id} onSelect={onSelect} />
            ))}
          </ul>
        )
      ) : (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {userList.length === 0 ? (
            <p className="text-sm text-ink/40 text-center mt-4">No one else has joined yet.</p>
          ) : (
            userList.map((u) => (
              <PersonCard
                key={u._id}
                u={u}
                onOpenChat={openChatFromCard}
                onAddFriend={onAddFriend}
                onAcceptRequest={onAcceptRequest}
                onRejectRequest={onRejectRequest}
              />
            ))
          )}
        </div>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </aside>
  );
}
