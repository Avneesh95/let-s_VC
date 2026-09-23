import { Phone, PhoneOff, Video } from "lucide-react";
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
    <div className="fixed inset-0 bg-[#08090C]/90 backdrop-blur-xl flex items-center justify-center z-[100] animate-fade-in-up select-none p-4">
      <div className="flex flex-col items-center gap-8 px-6 py-8 w-full max-w-sm bg-[#12151D]/90 border border-white/10 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] animate-scale-in">
        <div className="flex flex-col items-center gap-5">
          {/* Animated concentric pulsing glow */}
          <div className="relative flex items-center justify-center my-2">
            <span className="absolute w-36 h-36 rounded-full bg-brand/20 animate-ping [animation-duration:2s]" />
            <span className="absolute w-32 h-32 rounded-full ring-2 ring-brand/50 animate-pulse" />
            <Avatar user={caller} size="w-24 h-24" className="text-3xl relative shadow-[0_0_30px_rgba(244,96,15,0.4)] ring-4 ring-white/15" />
          </div>

          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest text-gold bg-gold/10 border border-gold/20 mb-2">
              <Video className="w-3 h-3 animate-pulse" /> Incoming Video Call
            </span>
            <h2 className="font-display font-bold text-2xl text-white tracking-tight">
              {caller.username}
            </h2>
            <p className="text-xs text-white/50 mt-1">is calling you on Peerly…</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-10 w-full pt-2">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={declineInvite}
              aria-label="Decline call"
              className="w-16 h-16 rounded-full bg-danger hover:brightness-110 active:scale-90 transition-all text-white flex items-center justify-center shadow-[0_8px_25px_rgba(178,59,51,0.5)] cursor-pointer"
            >
              <PhoneOff className="w-7 h-7" strokeWidth={2} />
            </button>
            <span className="text-[11px] font-semibold text-white/60">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={acceptInvite}
              aria-label="Accept call"
              className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 hover:brightness-110 active:scale-90 transition-all text-white flex items-center justify-center shadow-[0_8px_25px_rgba(16,185,129,0.5)] animate-bounce [animation-duration:1.5s] cursor-pointer"
            >
              <Phone className="w-7 h-7" strokeWidth={2} />
            </button>
            <span className="text-[11px] font-semibold text-emerald-400">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
