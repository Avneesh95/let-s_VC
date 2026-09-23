import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video,
  LogOut,
  Settings,
  Check,
  X,
  Plus,
  Users,
  MessageCircle,
  Search,
  Hash,
  Sparkles,
  ChevronRight
} from "lucide-react";
import generateRoomCode from "../utils/generateRoomCode";
import ThemeToggle from "./ThemeToggle";
import Avatar from "./Avatar";
import SettingsModal from "./SettingsModal";
import Logo from "./Logo";

function FriendActionButton({ user, onAddFriend, onAcceptRequest, onRejectRequest }) {
  if (user.friendStatus === "friends") {
    return (
      <span className="text-xs font-semibold text-brand dark:text-brand-light whitespace-nowrap inline-flex items-center gap-1 shrink-0 bg-brand/10 px-2.5 py-1 rounded-full">
        <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Friend
      </span>
    );
  }
  if (user.friendStatus === "request-sent") {
    return (
      <span className="text-xs text-ink/50 font-medium whitespace-nowrap bg-ink/5 px-2.5 py-1 rounded-full shrink-0">
        Pending
      </span>
    );
  }
  if (user.friendStatus === "request-received") {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAcceptRequest(user.requestId);
          }}
          className="w-7 h-7 flex items-center justify-center bg-brand hover:bg-brand-dark active:scale-95 transition-all text-white rounded-full shadow-sm"
          title="Accept request"
        >
          <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRejectRequest(user.requestId);
          }}
          className="w-7 h-7 flex items-center justify-center bg-danger hover:opacity-90 active:scale-95 transition-all text-white rounded-full shadow-sm"
          title="Decline request"
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
      className="text-xs font-semibold bg-brand hover:bg-brand-dark active:scale-95 transition-all text-white rounded-full px-3 py-1 whitespace-nowrap inline-flex items-center gap-1 shrink-0 shadow-xs"
    >
      <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add
    </button>
  );
}

function ChatRow({ u, isActive, isOnline, onSelect, unreadCount }) {
  return (
    <li
      onClick={() => onSelect(u)}
      className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
        isActive
          ? "bg-brand/15 dark:bg-brand/20 text-ink shadow-xs"
          : "hover:bg-ink/[0.04] text-ink/80 hover:text-ink"
      }`}
    >
      <span className="relative shrink-0">
        <Avatar user={u} size="w-10 h-10" />
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-surface" />
        )}
      </span>
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className={`truncate text-sm ${
            unreadCount ? "font-bold text-ink" : "font-medium text-ink"
          }`}
        >
          {u.username}
        </span>
        <span className="text-[11px] text-ink/45 truncate">
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>
      {!!unreadCount && (
        <span className="shrink-0 bg-brand text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center shadow-xs">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </li>
  );
}

function PersonCard({ u, isOnline, onOpenChat, onAddFriend, onAcceptRequest, onRejectRequest }) {
  const clickable = u.friendStatus === "friends";
  return (
    <div
      onClick={() => clickable && onOpenChat(u)}
      className={`flex items-center justify-between gap-3 p-3 rounded-xl border border-line/15 bg-surface/70 transition-all ${
        clickable
          ? "cursor-pointer hover:border-brand/40 hover:bg-surface hover:shadow-sm"
          : "hover:bg-surface"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="relative shrink-0">
          <Avatar user={u} size="w-10 h-10" />
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
          )}
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-sm text-ink truncate block">
            {u.username}
          </span>
          <span className="text-[11px] text-ink/45 truncate">
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>
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
  users = [],
  activeUser,
  onSelect,
  onlineUsers = [],
  currentUser = {},
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
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const friends = useMemo(
    () => userList.filter((u) => u.friendStatus === "friends"),
    [userList]
  );

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    return friends.filter((u) =>
      u.username.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }, [friends, searchQuery]);

  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return userList;
    return userList.filter((u) =>
      u.username.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }, [userList, searchQuery]);

  const pendingReceivedCount = userList.filter(
    (u) => u.friendStatus === "request-received"
  ).length;
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
    <aside className="w-full md:w-[320px] lg:w-[340px] bg-surface/90 backdrop-blur-md border-r border-line/15 flex flex-col shrink-0 min-h-0 h-full select-none">
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-line/15 flex items-center justify-between">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink/50 hover:text-ink hover:bg-ink/5 active:scale-95 transition-all"
          >
            <Settings className="w-4 h-4" strokeWidth={1.8} />
          </button>
          <button
            onClick={onLogout}
            title="Log out"
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink/50 hover:text-danger hover:bg-danger/10 active:scale-95 transition-all"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* User Profile Mini Bar */}
      <div className="px-4 py-2.5 border-b border-line/10 flex items-center justify-between bg-paper/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar user={currentUser} size="w-8 h-8" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-ink truncate">{currentUser.username}</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Connected
            </p>
          </div>
        </div>
      </div>

      {/* Quick Video Call Action Box */}
      <div className="p-3 border-b border-line/15 flex flex-col gap-2 bg-paper/40">
        <button
          onClick={startGroupCall}
          className="h-9.5 text-xs sm:text-sm bg-brand-gradient hover:brightness-110 active:scale-[0.98] transition-all text-white font-semibold rounded-xl inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <Video className="w-4 h-4" strokeWidth={2.2} /> Start New Call
        </button>
        <form onSubmit={joinGroupCall} className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0 flex items-center">
            <Hash className="w-3.5 h-3.5 text-ink/40 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Room Code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full h-8.5 min-w-0 border border-line/15 rounded-lg pl-8 pr-2.5 text-xs uppercase font-mono font-semibold placeholder:normal-case placeholder:font-sans placeholder:text-ink/40 bg-surface focus:outline-none focus:ring-2 focus:ring-brand/35 text-ink tracking-wider"
              maxLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="h-8.5 px-3 text-xs font-bold border border-line/15 rounded-lg hover:border-brand/40 hover:bg-brand/5 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all bg-surface text-ink shrink-0"
          >
            Join
          </button>
        </form>
      </div>

      {/* Search Contacts Bar */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-ink/40 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder={tab === "chats" ? "Search chats…" : "Find people…"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-paper/60 border border-line/15 rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-ink/40 hover:text-ink text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Segmented Tabs (Chats vs Find People) */}
      <div className="flex px-3 py-2 gap-1.5">
        <button
          onClick={() => {
            setTab("chats");
            setSearchQuery("");
          }}
          className={`relative flex-1 text-xs font-bold rounded-lg py-2 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
            tab === "chats"
              ? "bg-brand text-white shadow-xs"
              : "text-ink/70 hover:bg-ink/5"
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" /> Chats
          {totalUnreadCount > 0 && (
            <span className="bg-gold text-callbg text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ring-2 ring-surface">
              {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setTab("find");
            setSearchQuery("");
          }}
          className={`relative flex-1 text-xs font-bold rounded-lg py-2 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
            tab === "find"
              ? "bg-brand text-white shadow-xs"
              : "text-ink/70 hover:bg-ink/5"
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Find People
          {pendingReceivedCount > 0 && (
            <span className="bg-gold text-callbg text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ring-2 ring-surface">
              {pendingReceivedCount}
            </span>
          )}
        </button>
      </div>

      {/* Contact / User List Area */}
      {tab === "chats" ? (
        filteredFriends.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2 text-ink/50">
            <span className="w-10 h-10 rounded-full bg-ink/5 flex items-center justify-center text-ink/30 mb-1">
              <MessageCircle className="w-5 h-5" />
            </span>
            <p className="text-xs font-medium text-ink/70">
              {searchQuery ? "No matching contacts found" : "No active chats yet"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setTab("find")}
                className="text-xs text-brand dark:text-brand-light hover:underline font-semibold"
              >
                Discover and add friends
              </button>
            )}
          </div>
        ) : (
          <ul className="flex-1 min-h-0 overflow-y-auto thin-scrollbar py-1">
            {filteredFriends.map((u) => (
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
          {filteredPeople.length === 0 ? (
            <p className="text-xs text-ink/50 text-center mt-6">
              {searchQuery ? "No matching users found" : "No other users registered yet."}
            </p>
          ) : (
            filteredPeople.map((u) => (
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
