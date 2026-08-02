import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "./SocketContext";
import generateRoomCode from "../utils/generateRoomCode";

const CallInviteContext = createContext(null);

// A 1-1 "call" is just a friend-only invite into a private room — this
// context only handles the invite handshake (notify, accept, decline).
// All the actual video-calling logic lives entirely in GroupCall.jsx,
// the same code path a public group call uses. No WebRTC code here at all.
export function CallInviteProvider({ children }) {
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [incomingInvite, setIncomingInvite] = useState(null); // { from, roomCode, callerName }

  useEffect(() => {
    if (!socket) return;

    const handleInvite = ({ from, roomCode, callerName }) => {
      setIncomingInvite({ from, roomCode, callerName });
    };

    socket.on("call-invite", handleInvite);
    return () => socket.off("call-invite", handleInvite);
  }, [socket]);

  const callFriend = (targetUser, callerName) => {
    if (!socket) {
      alert("Not connected to the server yet — please wait a moment and try again.");
      return;
    }
    const roomCode = generateRoomCode();
    socket.emit("call-invite", { to: targetUser._id, roomCode, callerName });
    navigate(`/room/${roomCode}`);
  };

  const acceptInvite = () => {
    if (!incomingInvite) return;
    socket.emit("call-invite-response", {
      to: incomingInvite.from,
      roomCode: incomingInvite.roomCode,
      accepted: true,
    });
    navigate(`/room/${incomingInvite.roomCode}`);
    setIncomingInvite(null);
  };

  const declineInvite = () => {
    if (!incomingInvite) return;
    socket.emit("call-invite-response", {
      to: incomingInvite.from,
      roomCode: incomingInvite.roomCode,
      accepted: false,
    });
    setIncomingInvite(null);
  };

  return (
    <CallInviteContext.Provider value={{ incomingInvite, callFriend, acceptInvite, declineInvite }}>
      {children}
    </CallInviteContext.Provider>
  );
}

export const useCallInvite = () => useContext(CallInviteContext);
