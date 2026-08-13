import { useCallInvite } from "../context/CallInviteContext";
import Avatar from "./Avatar";

export default function IncomingCallBanner() {
  const { incomingInvite, acceptInvite, declineInvite } = useCallInvite();

  if (!incomingInvite) return null;

  const caller = {
    username: incomingInvite.callerName || "Someone",
    avatarColor: incomingInvite.callerAvatarColor,
    avatarUrl: incomingInvite.callerAvatarUrl,
  };

  return (
    <div className="fixed inset-0 bg-callbg/90 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in">
      <div className="flex flex-col items-center gap-8 px-6 w-full max-w-xs animate-scale-in">
        <div className="flex flex-col items-center gap-5">
          {/* Pulsing rings behind the avatar, like a live incoming-call ring */}
          <div className="relative flex items-center justify-center">
            <span className="absolute w-32 h-32 rounded-full bg-brand/25 animate-ping [animation-duration:1.8s]" />
            <span className="absolute w-32 h-32 rounded-full ring-2 ring-brand/40 animate-pulse" />
            <Avatar user={caller} size="w-24 h-24" className="text-3xl relative shadow-neon-brand" />
          </div>

          <div className="text-center">
            <p className="text-white/50 text-xs font-medium uppercase tracking-widest mb-1">
              Incoming call
            </p>
            <p className="font-display font-semibold text-2xl text-white">{caller.username}</p>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <button
            onClick={declineInvite}
            aria-label="Decline"
            className="w-16 h-16 rounded-full bg-danger hover:opacity-90 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 rotate-[135deg]">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
          </button>
          <button
            onClick={acceptInvite}
            aria-label="Accept"
            className="w-16 h-16 rounded-full bg-brand hover:bg-brand-dark active:scale-95 transition-all text-white flex items-center justify-center shadow-neon-brand"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
