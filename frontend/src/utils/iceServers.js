// STUN helps a peer discover its own public IP; TURN relays media when a
// direct peer-to-peer path can't be found (common once two devices are on
// different real-world networks, e.g. home WiFi vs mobile data).
// These TURN credentials are the Open Relay Project's free public demo
// server — fine for a portfolio project, rate-limited for production.
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
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
};

export default ICE_SERVERS;
