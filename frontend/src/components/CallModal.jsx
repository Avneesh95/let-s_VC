import { useEffect, useRef } from "react";

export default function CallModal({ callStatus, callerName, localStream, remoteStream, onAccept, onDecline, onEnd }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callStatus === "idle") return null;

  return (
    <div className="call-overlay">
      <div className="call-modal">
        {callStatus === "incoming" && (
          <>
            <p className="call-status-text">{callerName} is calling…</p>
            <div className="call-actions">
              <button className="accept-btn" onClick={onAccept}>Accept</button>
              <button className="decline-btn" onClick={onDecline}>Decline</button>
            </div>
          </>
        )}

        {callStatus === "calling" && (
          <>
            <p className="call-status-text">Calling {callerName}…</p>
            <button className="decline-btn" onClick={onEnd}>Cancel</button>
          </>
        )}

        {callStatus === "in-call" && (
          <>
            <div className="video-grid">
              <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
              <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
            </div>
            <button className="decline-btn end-call-btn" onClick={onEnd}>End Call</button>
          </>
        )}
      </div>
    </div>
  );
}
