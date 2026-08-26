import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) {
      socket?.disconnect();
      setSocket(null);
      return;
    }

    const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const socketUrl = rawApiUrl.replace(/\/+$/, "");

    const newSocket = io(socketUrl, {
      // A function, not a static object — Socket.IO calls this fresh on
      // every connection AND every automatic reconnection attempt. With a
      // static `{ token }` value, reconnection attempts kept resending
      // whatever token existed when the socket was first created, which
      // silently broke reconnection the moment that original token expired
      // or a new one was issued, even though localStorage had a valid one.
      auth: (cb) => cb({ token: localStorage.getItem("token") }),
      // Stay on HTTP long-polling instead of upgrading to a raw WebSocket.
      // The failure signature we kept hitting — a session ID already
      // present in the URL, meaning the initial handshake succeeded, but
      // the *upgrade* to WebSocket specifically failing right after —
      // points at the hosting platform's proxy not reliably supporting
      // that upgrade, not an application bug. Polling is a little less
      // efficient but works reliably anywhere a plain HTTP request does.
      transports: ["polling"],
      // Socket.IO's default connection timeout is 20s. Render's free tier
      // spins the backend down after inactivity, and waking it back up on
      // the first request can take 30-50+ seconds — comfortably longer
      // than the default, causing every "cold" connection attempt to give
      // up right as the server was finally waking up. 45s gives it room.
      timeout: 45000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on("online-users", (ids) => setOnlineUsers(ids));

    // If the server rejects the handshake specifically because the token
    // is invalid/expired (not a network blip — those show up as generic
    // "xhr poll error" / "timeout" messages instead), there's no point
    // retrying forever with a token that will never work. Log out cleanly
    // so the person lands back on the login screen instead of sitting in
    // a broken half-connected state with silently-failing requests.
    newSocket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
      if (err.message === "Invalid token" || err.message === "No token provided") {
        newSocket.disconnect();
        logout();
      }
    });

    setSocket(newSocket);

    return () => newSocket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
