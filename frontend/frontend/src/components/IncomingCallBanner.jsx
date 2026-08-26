import { Phone, PhoneOff } from "lucide-react";
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
          {/* Pulsing rings behind the avatar — gold accent on the outer
              ring so the "live" moment reads as premium, not generic green */}
          <div className="relative flex items-center justify-center">
            <span className="absolute w-32 h-32 rounded-full bg-brand/25 animate-ping [animation-duration:1.8s]" />
            <span className="absolute w-32 h-32 rounded-full ring-2 ring-gold/40 animate-pulse" />
            <Avatar user={caller} size="w-24 h-24" className="text-3xl relative shadow-neon-brand" />
          </div>

          <div className="text-center">
            <p className="text-gold/70 text-xs font-medium uppercase tracking-widest mb-1">
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
            <PhoneOff className="w-6.5 h-6.5" strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} />
          </button>
          <button
            onClick={acceptInvite}
            aria-label="Accept"
            className="w-16 h-16 rounded-full bg-brand hover:bg-brand-dark active:scale-95 transition-all text-white flex items-center justify-center shadow-neon-brand"
          >
            <Phone className="w-6.5 h-6.5" strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} />
          </button>
        </div>
      </div>
    </div>
  );
}
