import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { CallInviteProvider } from "./context/CallInviteContext";
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
          <Route path="/room/:roomCode" element={<GroupCall />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </CallInviteProvider>
    </SocketProvider>
  );
}
