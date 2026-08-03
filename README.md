# ChatApp — MERN + Socket.IO + WebRTC

A real-time chat and video calling app. Built to be **explainable in an interview**: every
feature maps to one clear technical decision, and the architecture was deliberately
simplified partway through development when a better approach became obvious — that
decision (and why) is the most interesting thing to talk about in this project.

## Feature set
- JWT authentication (register/login), plus guest access for video rooms only (no account)
- Friend system (send/accept/reject requests) — only friends can message or call each other
- 1-on-1 real-time messaging via Socket.IO, with image sharing, typing indicators, online presence
- Video calling — 1-1 calls and group calls (up to 6 people) share **one** implementation
  (see Architecture below)
- Adaptive call layout: full-screen + PiP for 1-2 people, grid for 3-6, matching how
  WhatsApp/Zoom scale their UI
- Camera on/off, mic on/off, front/back camera switching, mirrored self-preview — all live,
  no call interruption
- In-room text chat during video calls
- Installable as a PWA (Add to Home Screen / desktop install), with an offline-resilient
  app shell via a service worker
- Browser notifications for incoming calls when the tab isn't focused
- Responsive layout (Tailwind), production hardening (error boundary, 404 page, centralized
  API error handling, security headers, fail-fast env var validation)

**Deliberately excluded**: group calls beyond 6 people (would need an SFU media server, not
mesh WebRTC — see Architecture), screen sharing, call recording, message read receipts,
push notifications. Each is a reasonable "what would you add next" answer.

## Architecture

### The chat layer
Standard MERN: Express REST API for anything request/response (auth, fetching history,
friend requests), Socket.IO for anything that needs to push data without being asked
(new messages, typing, presence). JWT auth on both the REST routes and the Socket.IO
handshake. Friend-gating for messaging is enforced **server-side** in the socket
handler and the REST route — not just hidden in the UI, since a disabled button doesn't
stop someone from calling the API directly.

### The video calling layer — and a deliberate mid-project redesign
This app went through a real architectural decision worth describing in an interview.

**Originally**, 1-1 calls and group calls were two separate implementations: 1-1 calls had
their own WebRTC signaling (`call-user`/`incoming-call`/`answer-call`/ICE exchange) built
directly around a single peer connection, while group calls used a second, separate mesh
implementation to handle N participants. Both worked in principle, but maintaining two
parallel signaling paths for the same underlying feature (peer-to-peer video) meant twice
the surface area for bugs, and the 1-1 path — being the more bespoke of the two — kept
breaking in ways that were hard to reproduce.

**The fix wasn't another patch — it was recognizing the duplication.** A 1-1 call is just
a room with two people in it. So the two implementations were consolidated into one: every
video call, 1-1 or group, is now a **room** using the same mesh WebRTC code path. A "1-1
call" is just a friend-only *invite* into a private room — the invite is a lightweight
notification (`call-invite` → accept/decline), not a WebRTC negotiation. Once accepted,
both people land on the same `/room/:code` page and the existing, proven room-joining flow
takes over identically to a public group call.

This is the single most valuable thing to say about this project in an interview: not "I
built video calling," but "I noticed I had two parallel implementations of the same
feature, recognized that was the actual source of the bugs, and consolidated them" — that's
a senior-level instinct, not just a debugging story.

- **Server never touches media** — for both call types, the server only relays signaling
  messages (SDP offer/answer, ICE candidates) between browsers over Socket.IO. Actual
  audio/video flows peer-to-peer once negotiation completes.
- **Mesh, not SFU, capped at 6** — every participant connects directly to every other
  participant. Mesh bandwidth cost grows with the *square* of room size (each of N people
  uploads to N-1 others), so it's capped at 6 — past that you'd need an SFU media server
  (LiveKit, Daily, or self-hosted) that each person uploads to once. Explaining *why* 6, not
  just that it's capped, is the point.
- **STUN + TURN** — STUN helps a peer discover its public IP for direct connections; TURN
  (Open Relay Project's free tier here) relays media when a direct path can't be found,
  which is common once two people are on different real-world networks rather than one LAN.
- **ICE candidate queueing** — candidates can arrive before a peer connection exists yet
  (e.g. before the other person has clicked Accept); they're queued and flushed once the
  connection is ready, rather than silently dropped.
- **Muted-by-default remote video** — muted video autoplay is allowed unconditionally in
  every browser; audio autoplay is not. Starting muted guarantees video always renders, with
  a one-tap "unmute" as a separate, simpler action than fighting combined video+audio
  autoplay restrictions.
- **Camera/mic toggles use `track.enabled`**, not adding/removing tracks — instant on both
  sides, no renegotiation, no risk of dropping the call.
- **Guest access is a stateless JWT** — `POST /api/auth/guest` signs a short-lived token
  with a random id and a name, no database row. Works because the socket auth middleware
  only verifies the JWT signature, and the room-joining code path never touches the `User`
  model — video rooms don't need identity, so guests don't need an account.

## Project structure
```
backend/
  models/       User, Message, FriendRequest (Mongoose)
  routes/       REST endpoints (auth, users, messages, friends, upload)
  middleware/   JWT verification for protected routes
  socket/       Socket.IO handlers — messaging, friend-gated call invites, and the
                unified room-joining/signaling flow that serves both call types
  server.js     Express + HTTP server + Socket.IO bootstrap, env var validation,
                security headers, centralized error handler
frontend/
  src/context/  AuthContext (login state), SocketContext (shared connection),
                CallInviteContext (the friend-invite handshake — no WebRTC code here
                at all, just notify/accept/decline, then hands off to the room page)
  src/pages/    Home (public landing + guest room join), Login, Register, Chat,
                GroupCall (the one video-calling implementation, used for both call
                types), NotFound
  src/components/  Sidebar, ChatWindow, MessageBubble, MessageInput, IncomingCallBanner,
                    ErrorBoundary
```

## Running locally
**Backend**
```bash
cd backend
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, CLOUDINARY_* keys
npm install
npm run dev
```

**Frontend**
```bash
cd frontend
cp .env.example .env   # set VITE_API_URL
npm install
npm run dev
```

## Deployment
1. **Database**: MongoDB Atlas free cluster
2. **Image storage**: Cloudinary free account (cloud name, API key, API secret)
3. **Backend**: Render (or Railway) — set `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`
   (your deployed frontend URL, **no trailing slash** — a trailing slash silently breaks
   CORS since browsers never send one in the `Origin` header), and the `CLOUDINARY_*` vars
4. **Frontend**: Vercel or Netlify — set `VITE_API_URL` to your backend URL. If deploying
   to Netlify, make sure `frontend/public/_redirects` (containing `/* /index.html 200`)
   is present — without it, direct links to any route other than `/` 404, since Netlify
   doesn't know client-side routes exist unless told to fall through to `index.html`
5. Video calls need HTTPS in production (`getUserMedia` requires a secure context) — Render
   and Vercel/Netlify both provide this by default

## Talking points for interviews
- **Why network-first, not cache-first, for the service worker?** Cache-first would risk
  showing a stale build after a redeploy, which is exactly the kind of "why isn't my fix
  showing up" confusion worth avoiding in an app with frequent deploys. Network-first means
  the cache is purely a fallback for when you're offline, never a way to accidentally mask
  a fresh deploy.
- **Why doesn't the service worker touch API or Socket.IO requests?** A chat app's entire
  value is real-time, live data — caching a message list or a websocket handshake would mean
  serving stale conversations or silently breaking calls. The service worker only caches the
  static app shell (HTML/JS/CSS/icons); anything that talks to the backend always hits the
  network directly, un-intercepted.
- **The consolidation decision** (see Architecture) is the strongest story in this
  project — it's evidence of recognizing duplicate complexity and removing it, not just
  shipping a feature.
- **Why REST for uploads but sockets for messages?** Sockets suit small, frequent,
  structured events. A multi-megabyte file is a one-off request — REST with multipart
  form data is the right tool, and it reuses ordinary HTTP concerns (size limits,
  content-type validation) for free.
- **Client-side UX vs. server-side authorization**: disabling a button is a nicety; the
  friends-only rule for messaging and calling is enforced in the socket handlers and REST
  routes themselves, at every entry point that touches the data — not just the obvious one.
- **What would you add for real scale?** Redis for presence (currently an in-memory Map,
  fine for one server instance), an SFU for calls beyond 6 people, and your own TURN
  credentials instead of a shared public demo server.
