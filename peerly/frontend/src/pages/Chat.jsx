import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useCallInvite } from "../context/CallInviteContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";

export default function Chat() {
  const { user, logout } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const { callFriend } = useCallInvite();

  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  // Load contact list, reusable so friend actions can refresh it
  const refreshUsers = useCallback(() => {
    return api
      .get("/users")
      .then((res) => setUsers(res.data))
      .catch((err) => {
        console.error("Failed to load users:", err.response?.data || err.message);
        setUsers([]);
      });
  }, []);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  // Keep the currently-open chat's friend status in sync after any
  // friend-list refresh (e.g. right after accepting their request)
  useEffect(() => {
    if (!activeUser) return;
    const updated = users.find((u) => u._id === activeUser._id);
    if (updated) setActiveUser(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  // Load conversation history whenever the active chat changes
  useEffect(() => {
    if (!activeUser) return;
    setMessages([]);
    setIsOtherTyping(false);
    api
      .get(`/messages/${activeUser._id}`)
      .then((res) => setMessages(res.data))
      .catch((err) => {
        console.error("Failed to load messages:", err.response?.data || err.message);
        setMessages([]);
      });
  }, [activeUser]);

  // --- Chat message socket listeners ---
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (message) => {
      setMessages((prev) => {
        if (
          activeUser &&
          (message.sender === activeUser._id || message.receiver === activeUser._id)
        ) {
          return [...prev, message];
        }
        return prev;
      });
    };
    const handleSent = (message) => {
      // Guard like handleReceive does — without this, a "message-sent"
      // echo that arrives after the user has already switched to a
      // different contact (a real race: switching chats is instant, the
      // server round-trip isn't) got appended to whichever conversation
      // happened to be open when it landed, not the one it was actually
      // sent in.
      setMessages((prev) => {
        if (
          activeUser &&
          (message.sender === activeUser._id || message.receiver === activeUser._id)
        ) {
          return [...prev, message];
        }
        return prev;
      });
    };
    const handleMessageError = ({ message }) => alert(message);
    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, reactions } : m)));
    };
    const handleTyping = ({ senderId }) => {
      if (activeUser && senderId === activeUser._id) setIsOtherTyping(true);
    };
    const handleStopTyping = ({ senderId }) => {
      if (activeUser && senderId === activeUser._id) setIsOtherTyping(false);
    };

    socket.on("receive-message", handleReceive);
    socket.on("message-sent", handleSent);
    socket.on("message-error", handleMessageError);
    socket.on("message-reaction-updated", handleReactionUpdated);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);

    return () => {
      socket.off("receive-message", handleReceive);
      socket.off("message-sent", handleSent);
      socket.off("message-error", handleMessageError);
      socket.off("message-reaction-updated", handleReactionUpdated);
      socket.off("typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
    };
  }, [socket, activeUser]);

  const handleAddFriend = async (userId) => {
    try {
      await api.post(`/friends/request/${userId}`);
      refreshUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send request");
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await api.post(`/friends/accept/${requestId}`);
      refreshUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to accept request");
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.post(`/friends/reject/${requestId}`);
      refreshUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject request");
    }
  };

  const sendMessage = useCallback(
    (text) => {
      if (!socket || !activeUser) return;
      socket.emit("send-message", { receiverId: activeUser._id, text, type: "text" });
    },
    [socket, activeUser]
  );

  const sendImage = useCallback(
    (mediaUrl) => {
      if (!socket || !activeUser) return;
      socket.emit("send-message", { receiverId: activeUser._id, type: "image", mediaUrl });
    },
    [socket, activeUser]
  );

  const reactToMessage = useCallback(
    (messageId, emoji) => {
      if (!socket || !activeUser) return;
      socket.emit("react-message", { messageId, emoji, otherUserId: activeUser._id });
    },
    [socket, activeUser]
  );

  const handleTyping = () => {
    if (socket && activeUser) socket.emit("typing", { receiverId: activeUser._id });
  };
  const handleStopTyping = () => {
    if (socket && activeUser) socket.emit("stop-typing", { receiverId: activeUser._id });
  };

  return (
    <div className="flex h-dvh md:h-screen">
      <div className={`${activeUser ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
        <Sidebar
          users={users}
          activeUser={activeUser}
          onSelect={setActiveUser}
          onlineUsers={onlineUsers}
          currentUser={user}
          onLogout={logout}
          onAddFriend={handleAddFriend}
          onAcceptRequest={handleAcceptRequest}
          onRejectRequest={handleRejectRequest}
        />
      </div>
      <div className={`${activeUser ? "flex" : "hidden md:flex"} flex-1`}>
        <ChatWindow
          activeUser={activeUser}
          messages={messages}
          currentUserId={user.id}
          onSend={sendMessage}
          onSendImage={sendImage}
          onReact={reactToMessage}
          onTyping={handleTyping}
          onStopTyping={handleStopTyping}
          isOtherTyping={isOtherTyping}
          onStartCall={() => callFriend(activeUser)}
          isUserOnline={activeUser ? onlineUsers.includes(activeUser._id) : false}
          onBack={() => setActiveUser(null)}
        />
      </div>
    </div>
  );
}
