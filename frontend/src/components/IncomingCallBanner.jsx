import { useCallInvite } from "../context/CallInviteContext";

export default function IncomingCallBanner() {
  const { incomingInvite, acceptInvite, declineInvite } = useCallInvite();

  if (!incomingInvite) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
      <div className="bg-callbg text-white rounded-2xl p-6 min-w-[280px] w-[92vw] md:w-auto flex flex-col items-center gap-4">
        <p className="text-lg">
          <span className="font-display font-semibold">{incomingInvite.callerName}</span> is
          calling…
        </p>
        <div className="flex gap-3">
          <button
            onClick={acceptInvite}
            className="bg-brand hover:bg-brand-dark transition-colors text-white font-semibold rounded-full px-6 py-2"
          >
            Accept
          </button>
          <button
            onClick={declineInvite}
            className="bg-danger hover:opacity-90 transition-opacity text-white font-semibold rounded-full px-6 py-2"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
