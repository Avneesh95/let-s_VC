import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
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
//
// One thing this has to guard against: minimizing/expanding a call moves
// through real browser history entries (see the Minimize button and
// bubble tap in GroupCall.jsx), and a call that's fully hung up still
// leaves those old /room/:roomCode entries sitting in history behind it —
// there's no way to retroactively erase them. Without this guard, pressing
// the back button enough times eventually walks into one of those dead
// entries and this effect would cheerfully start the call right back up.
// Room codes are freshly generated per call and never reused, so refusing
// to (re)join any call this session has already hung up on is always safe
// and never blocks starting a genuinely new one.
function CallRouteEntry() {
  const { roomCode } = useParams();
  const { activeRoomCode, startCall } = useCallInvite();
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    const normalized = String(roomCode || "").toUpperCase();
    if (!normalized || normalized === activeRoomCode) return;
    if (sessionStorage.getItem(`callEnded:${normalized}`) === "1") {
      navigate(user ? "/chat" : "/", { replace: true });
      return;
    }
    startCall(normalized);
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
