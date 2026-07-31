# ChatApp — MERN + Socket.IO Real-Time Chat

A minimal WhatsApp-style 1-on-1 chat app. Built to be **easy to explain in an interview**:
every feature maps to one clear technical concept, nothing extra to justify.

## Feature set (intentionally scoped)
- JWT authentication (register/login)
- Contact list (all other registered users)
- 1-on-1 real-time messaging via Socket.IO
- Message persistence in MongoDB (chat history survives refresh/logout)
- Online/offline presence
- Typing indicator
- Image sharing (upload to Cloudinary, sent as a message)
- 1-on-1 video calling (WebRTC, signaled over the existing Socket.IO connection) — happens
  on its own dedicated `/call` route rather than as an overlay on the chat screen
- Front/back camera switching mid-call (mobile)
- Guests can join a room directly from a shared link — no detour through a login page,
  just a quick name prompt right on the room itself
- Friend system: send/accept/reject friend requests — only friends can message or call each other
- Responsive layout (Tailwind CSS)
- Group video calls (up to 6 people) via shareable room codes — no friendship required to join
  a room, since the room code itself is the invite (like a Zoom/Meet link)
- Guest access: anyone can join a video room with just a name — no account needed. The full
  chat/friends app still requires login/register; guests only ever see the video room.
- Adaptive call layout: full-screen + small self-preview for 1-on-1-sized rooms (1-2 people),
  automatically switching to a grid once 3+ people join — same pattern WhatsApp/Zoom use
- Camera on/off and mic on/off toggles during any call (1-1 or group), plus front/back camera
  switching — all live, no call interruption
- Front camera preview is mirrored (like WhatsApp/every video app) — the video actually sent
  to others is not flipped, only your own local preview
- Lightweight in-room text chat during group video calls (ephemeral, not saved — matches how
  rooms themselves work)
- Guests choose their own room code to join (no auto-generated codes) — makes it trivial to
  share a memorable code with friends before anyone's even online

**Deliberately excluded** (mention this in interviews — it shows judgment, not just scope creep):
group chats/calls, screen sharing, call recording, message read receipts, message
editing, push notifications, friend removal (you can reject a pending request but
not un-friend someone once accepted — a reasonable "what's next" answer).

## Architecture
```
Browser (React) ⇄ REST API (Express)   → auth, fetching user list & message history
Browser (React) ⇄ WebSocket (Socket.IO) → sending/receiving messages, typing, presence
                        ↓
                    MongoDB (Mongoose)
```
- **REST vs WebSocket split**: REST handles anything request/response (login, loading
  history). Socket.IO handles anything that needs to push data to the client without
  it asking — a new message arriving, a typing event. This split is the #1 thing to
  be able to explain clearly.
- **Auth on the socket**: the JWT is passed in the Socket.IO handshake (`auth: { token }`)
  and verified server-side before the connection is accepted — same identity system
  as the REST API, just applied to a persistent connection.
- **Presence**: an in-memory `Map<userId, socketId>` on the server tracks who's online.
  Simple and correct for a single server instance. (Good follow-up answer: "at scale
  you'd move this to Redis so presence works across multiple server instances.")
- **Image sharing**: the client uploads a file to `POST /api/upload` (REST, not the
  socket — file uploads don't belong on a WebSocket), which streams it straight to
  Cloudinary via `multer-storage-cloudinary`. The server never stores the file itself,
  only the returned URL, which then gets sent as a normal chat message (`type: "image"`).
- **Video calling (WebRTC)**: the two browsers negotiate a *direct* peer-to-peer
  connection for audio/video — the server is never in the media path, it only relays
  three handshake messages over Socket.IO: the SDP `offer`, the SDP `answer`, and ICE
  candidates. This is the standard WebRTC signaling pattern. A STUN server helps each
  peer discover its public IP, and a TURN server (Open Relay Project's free tier here)
  relays media when a direct path can't be found — common when two peers are on
  different real-world networks (home WiFi + mobile data, corporate NAT, etc.), which
  is exactly the case once this is actually deployed rather than tested on one LAN.
  For production you'd swap in your own TURN credentials (Twilio, Metered.ca, or a
  self-hosted `coturn`) instead of the public demo ones, since they're rate-limited.

## Project structure
```
backend/
  models/       Mongoose schemas (User, Message)
  routes/       REST endpoints (auth, users, messages)
  middleware/   JWT verification for protected routes
  socket/       Socket.IO connection + event handlers
  server.js     Express + HTTP server + Socket.IO bootstrap
frontend/
  src/context/  AuthContext (login state), SocketContext (shared socket connection),
                CallContext (1-1 call state — lifted out of Chat.jsx so it survives
                navigating to the dedicated /call route and back)
  src/pages/    Home (public landing + guest room join), Login, Register, Chat,
                CallPage (dedicated 1-1 call screen), GroupCall (video room)
  src/components/  Sidebar, ChatWindow, MessageBubble, MessageInput
```

## Running locally
**Backend**
```bash
cd backend
cp .env.example .env   # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev
```

**Frontend**
```bash
cd frontend
cp .env.example .env   # set VITE_API_URL to your backend URL
npm install
npm run dev
```

## Deployment (all free-tier friendly)
1. **Database**: create a free cluster on MongoDB Atlas, get the connection string.
2. **Image storage**: create a free Cloudinary account, get your cloud name, API key,
   and API secret from the dashboard.
3. **Backend**: deploy `backend/` to Render (or Railway) as a Node web service.
   Set env vars `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` (your deployed frontend URL),
   and the three `CLOUDINARY_*` vars.
4. **Frontend**: deploy `frontend/` to Vercel (or Netlify). Set `VITE_API_URL` to your
   Render backend URL. Vite auto-detects the build (`npm run build`, output `dist/`).
5. Update the backend's `CLIENT_URL` and the CORS/Socket.IO origin to match your live
   frontend URL once deployed.
6. Video calls need HTTPS in production (`getUserMedia` requires a secure context) —
   Render and Vercel both give you this by default, so no extra setup needed there.

## Talking points for interviews
- **Why does the 1-1 call live in a React Context instead of the Chat component?**
  Originally it was local state in `Chat.jsx`, rendered as a full-screen overlay on top
  of the chat UI. Moving it to its own `/call` route (matching how the group call
  already worked) meant the call state — the peer connection, the media streams, ICE
  candidates — had to survive a route change, which local component state can't do
  (it's destroyed when the component unmounts). Lifting it into `CallContext` alongside
  the existing `AuthContext`/`SocketContext` pattern solved that: the call keeps running
  regardless of which page is currently rendered, and `Chat.jsx`, `CallPage.jsx`, and
  even the sidebar's incoming-call handling all just read from the same shared state.
- **Why Socket.IO over raw WebSocket?** Auto-reconnection, fallback transports, and
  room/broadcast helpers — you'd have to hand-roll all of that with raw `ws`.
- **Why store messages before emitting?** So a message isn't lost if the receiver is
  offline — it's already in MongoDB and will show up when they load history.
- **What would break at scale?** The in-memory presence map — it only works with one
  server process. Multiple instances would need Redis pub/sub (Socket.IO has a Redis
  adapter for exactly this) so events reach a socket connected to a different instance.
- **Security**: passwords hashed with bcrypt, JWT-protected REST routes, JWT-verified
  socket handshake, no sensitive data in the JWT payload beyond the user ID.
- **Why upload images over REST instead of the socket?** Sockets are for small,
  frequent, structured events. A multi-megabyte file is a one-off request/response —
  REST (with multipart form data) is the right tool, and it lets you reuse normal HTTP
  concerns like file size limits and content-type validation.
- **Why does the server relay WebRTC signaling instead of just connecting the peers
  directly?** The two browsers don't know how to reach each other yet — they need a
  shared channel to exchange connection info first. Once that handshake finishes, media
  flows peer-to-peer and the server drops out of the picture entirely.
- **How does camera switching work without dropping the call?** `RTCRtpSender.replaceTrack()`
  swaps the outgoing video track on the existing peer connection in place — no offer/answer
  renegotiation needed, so the call doesn't interrupt or reconnect.
- **What's the difference between STUN and TURN?** STUN just tells a peer its own
  public IP/port so the *other* peer can try to connect directly to it — cheap, but
  only works if the network path allows a direct connection. TURN is a fallback relay
  server: if a direct path can't be established (common with mobile carrier NAT or
  strict firewalls), media is routed through the TURN server instead. That's why a
  call that works fine on the same WiFi can fail once it's phone-on-mobile-data vs
  laptop-on-home-WiFi — TURN is what recovers it.
- **Group calls and why they're capped at 6**: group calls use the same peer-to-peer
  mesh pattern as the 1-1 call — every participant opens a direct `RTCPeerConnection`
  to every other participant. The problem: mesh's bandwidth cost grows with the
  *square* of the room size (each of N people uploads to N-1 others), so a participant's
  upload bandwidth becomes the bottleneck fast — most home connections struggle past
  5-6 simultaneous outgoing video streams. Real apps like Zoom or Meet solve this with
  an SFU (Selective Forwarding Unit) — a media server each person uploads to *once*,
  which then forwards streams to everyone else, so upload cost stays constant
  regardless of room size. Building an SFU from scratch is a substantial project on its
  own (or you'd use a hosted one like LiveKit/Daily/Agora); capping mesh at 6 here is a
  deliberate, explainable tradeoff rather than a naive oversight — a strong thing to
  articulate if asked "would this scale to 100 people?" (Answer: no, and here's exactly
  why, and here's what you'd swap in instead.)
- **Room joining is by code, not friendship** — unlike 1-1 chat/calls, anyone with a
  room code can join a group call, the same way a Zoom/Meet link works. Rooms live only
  in memory on the server (no database model) since a room is really just "whoever
  currently has the link open" — it's created the moment the first person joins and
  disappears once the last person leaves.
- **Guest access is a stateless JWT, not a database row.** `POST /api/auth/guest` takes
  just a name and signs a short-lived (12h) token carrying a random id — no MongoDB
  write at all. This works because the socket auth middleware only verifies the JWT
  signature and never checks whether that user id exists in the database; the
  room-signaling code path (join/offer/answer/ICE) never touches the `User` model
  either. Guests are fully capable of joining and using video rooms, but the `/chat`
  route (friends, messaging, 1-1 calls) explicitly checks `user.isGuest` and redirects
  them away, since those features are backed by a real account. This is a clean
  illustration of scoping a feature to exactly the data it needs — video rooms don't
  need identity, so guests don't need an account.
- **Camera/mic on-off toggles**: rather than removing tracks from the peer connection
  (which would require renegotiation — a fresh offer/answer round trip), toggling
  `track.enabled = false` is the standard mute/unmute pattern. The track stays attached
  to the connection, just stops producing frames/audio — instant on both sides, no
  renegotiation, no risk of dropping the call.
- **Friend system & authorization**: a `FriendRequest` document only exists while
  pending — accepting it adds each user's ID to the other's `friends` array (on the
  `User` model) and deletes the request; rejecting just deletes it. There's
  deliberately no `status` field to track — "pending" is just "the document exists."
  The important part: the friends-only rule for both **messaging and calling** is
  enforced **server-side** — in the `send-message` and `call-user` socket handlers,
  and again in the REST route for fetching message history — not just by hiding UI
  elements. A disabled button is a UX nicety; the actual authorization check has to
  live somewhere the client can't bypass it by editing JavaScript in devtools. This
  distinction (client-side UX vs. server-side authorization, and checking it at
  *every* entry point that touches the data, not just the obvious one) is a strong
  thing to articulate in an interview.
