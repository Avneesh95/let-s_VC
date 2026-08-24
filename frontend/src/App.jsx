import { useEffect } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { CallInviteProvider, useCallInvite } from "./context/CallInviteContext";
import IncomingCallBanner from "./components/IncomingCallBanner";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import GroupCall from "./pages/GroupCall";
import NotFound from "./pages/NotFound";

function PrivateRoute({ children, requireFullAccount }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  // Guests (no real account) can join video rooms but not the full chat app
  if (requireFullAccount && user.isGuest) return <Navigate to="/" />;
  return children;
}

// Matched only for the URL /room/:roomCode itself (typing/pasting the link,
// opening a shared link cold, or a page refresh mid-call — all of which
// need to land straight back in the call). It does nothing but register
// that room as the "active call" and get out of the way; the call's actual
// UI is rendered by <ActiveCallOverlay> below, not by this route, which is
// exactly what lets the call keep running after the URL changes away from
// here (minimizing).
function CallRouteEntry() {
  const { roomCode } = useParams();
  const { activeRoomCode, startCall } = useCallInvite();
  useEffect(() => {
    const normalized = String(roomCode || "").toUpperCase();
    if (normalized && normalized !== activeRoomCode) startCall(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);
  return null;
}

// Rendered as a sibling of <Routes>, not inside it — so it stays mounted
// (camera, mic, and WebRTC connections all alive) no matter which route is
// currently showing. Whichever page IS matched by <Routes> renders
// underneath/behind it exactly like WhatsApp's chat list sits behind a
// minimized call bubble; GroupCall itself decides whether to take up the
// full screen or shrink to a small floating bubble based on whether the
// current URL is still /room/:roomCode.
function ActiveCallOverlay() {
  const { activeRoomCode } = useCallInvite();
  if (!activeRoomCode) return null;
  return <GroupCall roomCode={activeRoomCode} />;
}

export default function App() {
  return (
    <SocketProvider>
      <CallInviteProvider>
        <IncomingCallBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/chat"
            element={
              <PrivateRoute requireFullAccount>
                <Chat />
              </PrivateRoute>
            }
          />
          <Route path="/room/:roomCode" element={<CallRouteEntry />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ActiveCallOverlay />
      </CallInviteProvider>
    </SocketProvider>
  );
}
