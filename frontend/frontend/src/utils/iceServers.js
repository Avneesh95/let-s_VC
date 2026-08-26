// STUN helps a peer discover its own public IP; TURN relays media when a
// direct peer-to-peer path can't be found (common once two devices are on
// different real-world networks, e.g. home WiFi vs mobile data).
//
// ⚠️ CONNECTION SPEED, ESPECIALLY FOR GROUP CALLS: the TURN entries below
// are free public-demo credentials, shared by every developer testing a
// WebRTC project worldwide. A 1-1 call only ever needs one relayed stream
// if it falls back to TURN, so it's often fine; a group call is mesh
// WebRTC (see socket.js), so each participant can need a *separate*
// relayed stream to every other participant at once — several times the
// relay bandwidth of a 1-1 call, hitting the same congested free pool.
// That's the single biggest reason a group call gets stuck on
// "Connecting…" far more often than a 1-1 call does.
//
// The real fix: get your own free TURN credentials (a few minutes, no
// cost) so group calls aren't sharing bandwidth with every other
// developer's demo traffic:
//   - metered.ca — free tier, dashboard gives you a personal set of
//     turn:/turns: URLs + username/credential (swap them in below)
//   - Cloudflare Calls, Twilio Network Traversal Service, or Xirsys also
//     have free/trial tiers
// A private key on the same free-tier infrastructure is usually dramatically
// faster than the shared demo one, since it isn't absorbing everyone else's
// load. Until then, GroupCall.jsx now detects a connection that's stuck and
// automatically retries once instead of hanging on "Connecting…" forever,
// and shows a manual Retry button if it's still stuck after that.
const ICE_SERVERS = {
  iceServers: [
    // Several STUN servers (not just one) so candidate gathering has
    // redundancy — if one is briefly slow to respond, others still return
    // quickly instead of the whole gathering step stalling on it.
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:global.stun.twilio.com:3478" },
    // TURN — this is the fallback relay used when direct P2P fails. It's
    // still the shared Open Relay Project demo pool (see the note above);
    // swap in your own credentials here for real reliability, especially
    // for group calls.
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    // Add a second provider's TURN entry here once you've signed up for
    // your own free credentials (see the note above) — having two
    // independent pools is what actually buys the redundancy; a second
    // set of *demo* credentials would just be another shared pool.
  ],
  // Lets the browser start gathering ICE candidates as soon as the
  // RTCPeerConnection is created, in parallel with the offer/answer
  // exchange, instead of waiting until createOffer/createAnswer to begin —
  // a small but free head start on connection time.
  iceCandidatePoolSize: 10,
};

export default ICE_SERVERS;
