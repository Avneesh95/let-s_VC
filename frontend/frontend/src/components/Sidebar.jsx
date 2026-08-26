import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, LogOut, Settings, Check, X, Plus, Users, MessageCircle } from "lucide-react";
import generateRoomCode from "../utils/generateRoomCode";
import ThemeToggle from "./ThemeToggle";
import Avatar from "./Avatar";
import SettingsModal from "./SettingsModal";
import Logo from "./Logo";

function FriendActionButton({ user, onAddFriend, onAcceptRequest, onRejectRequest }) {
  if (user.friendStatus === "friends") {
    return (
      <span className="text-xs text-brand dark:text-brand-light font-medium whitespace-nowrap inline-flex items-center gap-1">
        <Check className="w-3.5 h-3.5" strokeWidth={2} /> Friend
      </span>
    );
  }
  if (user.friendStatus === "request-sent") {
    return <span className="text-xs text-ink/55 whitespace-nowrap">Requested</span>;
  }
  if (user.friendStatus === "request-received") {
    return (
      <div className="flex gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAcceptRequest(user.requestId);
          }}
          className="w-7 h-7 flex items-center justify-center bg-brand hover:bg-brand-dark transition-colors text-white rounded-full"
          title="Accept"
        >
          <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRejectRequest(user.requestId);
          }}
          className="w-7 h-7 flex items-center justify-center bg-danger hover:opacity-90 transition-opacity text-white rounded-full"
          title="Decline"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
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
      className="text-xs bg-brand hover:bg-brand-dark transition-colors text-white rounded-full pl-2 pr-2.5 py-1 whitespace-nowrap inline-flex items-center gap-0.5"
    >
      <Plus className="w-3 h-3" strokeWidth={2.5} /> Add
    </button>
  );
}

// A chat row — a friend you can click straight into a conversation with.
function ChatRow({ u, isActive, isOnline, onSelect, unreadCount }) {
  return (
    <li
      onClick={() => onSelect(u)}
      className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
        isActive ? "bg-brand/10 dark:bg-brand/15" : "hover:bg-ink/[0.035]"
      }`}
    >
      <span className="relative shrink-0">
        <Avatar user={u} />
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-neon shadow-neon ring-2 ring-surface" />
        )}
      </span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className={`truncate text-[0.925rem] ${unreadCount ? "font-semibold text-ink" : "font-medium text-ink"}`}>
          {u.username}
        </span>
      </span>
      {!!unreadCount && (
        <span className="shrink-0 bg-brand text-white text-[10px] font-semibold min-w-[1.125rem] h-4.5 px-1 rounded-full flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </li>
  );
}

// A person card in "Find People" — everyone, not just friends, since this
// is the discovery view. Clicking a card that's already a friend opens
// their chat; clicking anyone else is just the add/accept/reject actions.
function PersonCard({ u, isOnline, onOpenChat, onAddFriend, onAcceptRequest, onRejectRequest }) {
  const clickable = u.friendStatus === "friends";
  return (
    <div
      onClick={() => clickable && onOpenChat(u)}
      className={`flex items-center gap-3 p-3 rounded-xl border border-line/10 bg-surface ${
        clickable ? "cursor-pointer hover:border-brand/40 hover:shadow-premium" : ""
      } transition-all`}
    >
      <span className="relative shrink-0">
        <Avatar user={u} size="w-11 h-11" />
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-neon shadow-neon ring-2 ring-surface" />
        )}
      </span>
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
  unreadCounts = {},
}) {
  const userList = Array.isArray(users) ? users : [];
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [tab, setTab] = useState("chats"); // "chats" | "find"
  const [settingsOpen, setSettingsOpen] = useState(false);

  const friends = userList.filter((u) => u.friendStatus === "friends");
  const pendingReceivedCount = userList.filter((u) => u.friendStatus === "request-received").length;
  const totalUnreadCount = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);

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
    <aside className="w-full md:w-[300px] bg-surface border-r border-line/10 flex flex-col shrink-0 min-h-0">
      <div className="px-4 py-3.5 border-b border-line/10 flex items-center justify-between">
        <Logo size="sm" />
        <div className="flex items-center gap-0.5">
          <ThemeToggle />
          <button
            onClick={onLogout}
            title="Log out"
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink/50 hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <button
        onClick={() => setSettingsOpen(true)}
        className="flex items-center gap-2.5 px-4 py-3 border-b border-line/10 hover:bg-ink/[0.03] transition-colors text-left"
      >
        <Avatar user={currentUser} size="w-8 h-8" />
        <span className="text-sm font-medium text-ink truncate flex-1">{currentUser.username}</span>
        <span className="text-ink/30" title="Settings">
          <Settings className="w-4 h-4" strokeWidth={1.75} />
        </span>
      </button>

      <div className="px-4 py-3.5 border-b border-line/10 flex flex-col gap-2 bg-paper/60">
        <button
          onClick={startGroupCall}
          className="text-sm bg-brand-gradient hover:brightness-110 transition-all text-white font-semibold rounded-xl py-2.25 inline-flex items-center justify-center gap-2 shadow-neon-brand"
        >
          <Video className="w-4 h-4" strokeWidth={1.75} /> New group call
        </button>
        <form onSubmit={joinGroupCall} className="flex gap-2">
          <input
            type="text"
            placeholder="Enter room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="flex-1 min-w-0 border border-line/15 rounded-xl px-3 py-1.75 text-sm focus:outline-none focus:ring-2 focus:ring-brand/35 uppercase bg-surface"
            maxLength={6}
          />
          <button
            type="submit"
            className="text-sm border border-line/15 rounded-xl px-3.5 py-1.75 hover:border-brand/40 hover:bg-surface transition-colors bg-surface font-medium"
          >
            Join
          </button>
        </form>
      </div>

      <div className="flex px-3 pt-3 gap-1">
        <button
          onClick={() => setTab("chats")}
          className={`relative flex-1 text-sm font-medium rounded-xl py-2 transition-colors inline-flex items-center justify-center gap-1.5 ${
            tab === "chats" ? "bg-brand text-white shadow-sm" : "text-ink/70 hover:bg-ink/5"
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> Chats
          {totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-gold text-callbg text-[10px] font-semibold w-4.5 h-4.5 rounded-full flex items-center justify-center ring-2 ring-surface">
              {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("find")}
          className={`relative flex-1 text-sm font-medium rounded-xl py-2 transition-colors inline-flex items-center justify-center gap-1.5 ${
            tab === "find" ? "bg-brand text-white shadow-sm" : "text-ink/70 hover:bg-ink/5"
          }`}
        >
          <Users className="w-3.5 h-3.5" strokeWidth={1.75} /> Find people
          {pendingReceivedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-gold text-callbg text-[10px] font-semibold w-4.5 h-4.5 rounded-full flex items-center justify-center ring-2 ring-surface">
              {pendingReceivedCount}
            </span>
          )}
        </button>
      </div>

      {tab === "chats" ? (
        friends.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2">
            <span className="w-11 h-11 rounded-full bg-ink/5 flex items-center justify-center text-ink/25 mb-1">
              <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
            </span>
            <p className="text-sm text-ink/60">No friends yet.</p>
            <button
              onClick={() => setTab("find")}
              className="text-sm text-brand dark:text-brand-light hover:underline font-medium"
            >
              Find people to chat with
            </button>
          </div>
        ) : (
          <ul className="flex-1 min-h-0 overflow-y-auto thin-scrollbar py-2">
            {friends.map((u) => (
              <ChatRow
                key={u._id}
                u={u}
                isActive={activeUser?._id === u._id}
                isOnline={onlineUsers.includes(u._id)}
                onSelect={onSelect}
                unreadCount={unreadCounts[u._id]}
              />
            ))}
          </ul>
        )
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar p-3 flex flex-col gap-2">
          {userList.length === 0 ? (
            <p className="text-sm text-ink/60 text-center mt-4">No one else has joined yet.</p>
          ) : (
            userList.map((u) => (
              <PersonCard
                key={u._id}
                u={u}
                isOnline={onlineUsers.includes(u._id)}
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
