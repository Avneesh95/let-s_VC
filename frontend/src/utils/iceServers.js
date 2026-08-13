// STUN helps a peer discover its own public IP; TURN relays media when a
// direct peer-to-peer path can't be found (common once two devices are on
// different real-world networks, e.g. home WiFi vs mobile data).
//
// ⚠️ CONNECTION SPEED: the TURN entries below use the Open Relay Project's
// *public demo* credentials — shared by every developer testing a WebRTC
// project, worldwide, for free. It's fine to get the app working, but it's
// often congested, which is the #1 cause of a slow "connecting…" call —
// whenever a direct P2P path isn't available, you fall back to a relay
// that's overloaded by other people's traffic, not just yours.
//
// The fix: get your own free TURN credentials (a few minutes, no cost):
//   - metered.ca — free tier, dashboard gives you a personal set of
//     turn:/turns: URLs + username/credential (swap them in below)
//   - Cloudflare Calls, Twilio Network Traversal Service, or Xirsys also
//     have free/trial tiers
// A private key on the same free-tier infrastructure is usually dramatically
// faster than the shared demo one, since it isn't absorbing everyone else's
// load.
const ICE_SERVERS = {
  iceServers: [
    // Several STUN servers (not just one) so candidate gathering has
    // redundancy — if one is briefly slow to respond, others still return
    // quickly instead of the whole gathering step stalling on it.
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
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
  ],
  // Lets the browser start gathering ICE candidates as soon as the
  // RTCPeerConnection is created, in parallel with the offer/answer
  // exchange, instead of waiting until createOffer/createAnswer to begin —
  // a small but free head start on connection time.
  iceCandidatePoolSize: 10,
};

export default ICE_SERVERS;
