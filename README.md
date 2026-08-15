# ChatApp — MERN + Socket.IO + WebRTC

A real-time chat and video calling app. Built to be **explainable in an interview**: every
feature maps to one clear technical decision, and the architecture was deliberately
simplified partway through development when a better approach became obvious — that
decision (and why) is the most interesting thing to talk about in this project.

## Feature set
- JWT authentication (register/login), plus guest access for video rooms only (no account)
- Friend system (send/accept/reject requests) — only friends can message or call each other
- Two distinct views instead of one ambiguous list: **Chats** (friends only, click straight
  into a conversation) and **Find People** (everyone, as browsable cards with add/accept/
  reject actions) — see Architecture for why
- 1-on-1 real-time messaging via Socket.IO, with image sharing, message reactions
  (one per person per message, toggle to remove), typing indicators, online presence
- Light/dark mode, persisted and defaulting to system preference
- Profile settings: change username, change password, upload a profile picture
- Ringtone on incoming calls (and a softer ringback for the caller while waiting) —
  synthesized in-browser via the Web Audio API, no audio file to host
- Screen sharing during any call — swaps the outgoing video track live, no renegotiation
- Video calling — 1-1 calls and group calls (up to 6 people) share **one** implementation
  (see Architecture below)
- Adaptive call layout: full-screen + PiP for 1-2 people, grid for 3-6, matching how
  WhatsApp/Zoom scale their UI
- Camera on/off, mic on/off, front/back camera switching, mirrored self-preview — all live,
  no call interruption
- In-room text chat during video calls
- Installable as a PWA (Add to Home Screen / desktop install), with an offline-resilient
  app shell via a service worker
- Browser notifications for incoming calls when the tab isn't focused, plus Web Push
  notifications that can reach the callee even when the app is fully closed (see
  Architecture — this is a real trade-off, not a full replacement for the in-tab ringtone)
- Rate limiting on auth endpoints, server-side email/password validation, and a shared
  `asyncHandler` wrapper so an async route error returns a clean response instead of
  hanging the request (a real bug this project used to have — see Architecture)
- Responsive layout (Tailwind), production hardening (error boundary, 404 page, centralized
  API error handling, security headers, fail-fast env var validation)

**Deliberately excluded**: group calls beyond 6 people (would need an SFU media server, not
mesh WebRTC — see Architecture), call recording, message read receipts.

## Architecture

### Chats vs. Find People — resolving an actual UX ambiguity
Early on, the sidebar showed every registered user in one list, with add/accept/reject
buttons mixed in for non-friends. That's genuinely ambiguous: should a chat app's main
list show everyone, or only people you can actually message? The answer is **both — in
two different places**, which is what every real chat app does even if it's not obvious
at first: a **Chats** list of people you have an actual relationship with, and a separate
**Find People** view for discovery. Conflating them into one list is the actual bug being
fixed here, not just a styling choice.
- **Chats** — friends only, click a row to open the conversation.
- **Find People** — everyone, rendered as cards (not the same list styling as Chats, so
  it's visually clear this is a different kind of screen), each with an add/pending/accept/
  reject action depending on relationship status. Clicking a card for someone who's already
  a friend opens their chat (jumps back to the Chats tab); clicking anyone else just exposes
  the friend-request actions, since you can't message someone you're not friends with yet.

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

### Background call notifications — and their real limitation
When you call a friend, the server first tries their live Socket.IO connection (covers both
the foreground tab and a backgrounded-but-still-open tab — the client's own Notification API
call handles surfacing that case). If there's no live socket at all — the app is fully
closed, not just backgrounded — that used to just fail with "user is offline" and the callee
never found out. Now the server falls back to **Web Push**: each device that's opted in
(Settings → "Ring when app is closed") has a subscription stored on the `User` document, and
the service worker (`public/sw.js`) handles the `push` event with a persistent, high-priority
OS notification carrying Answer/Decline actions that deep-link straight into the room.

The honest limitation, worth stating up front in an interview rather than glossing over: **a
closed app can't loop a continuous ringtone** — there's no page for a service worker to play
audio through, only a one-shot system notification sound plus vibration. The in-tab
synthesized ringtone (see below) still owns the "actually rings" experience; push covers the
"at least tell them a call is happening" case for a fully closed app. Conflating the two would
be overselling what's technically possible with today's Push API.

### Two other real bugs worth mentioning
- **Async route handlers with no `try/catch`** (`friends.js`'s accept/reject/request routes)
  would hang a request indefinitely on a DB error, since Express 4 doesn't forward async
  rejections to the error handler automatically. Fixed with a small `asyncHandler` wrapper
  rather than manually try/catching every route — the fix is the *pattern*, not a one-off patch.
- **No rate limiting or input validation on `/api/auth`** meant a 1-character password and
  brute-force login attempts were both accepted. `express-rate-limit` plus real email-format
  and password-length checks close that gap without adding much code.

## Project structure
```
backend/
  models/       User (now also stores Web Push subscriptions), Message, FriendRequest
  routes/       REST endpoints (auth, users, messages, friends, upload, push)
  middleware/   JWT verification for protected routes, asyncHandler for clean async errors
  socket/       Socket.IO handlers — messaging, friend-gated call invites (with a Web
                Push fallback when the callee has no live socket), and the unified
                room-joining/signaling flow that serves both call types
  config/       MongoDB connection, Cloudinary, Web Push/VAPID setup
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
                    SettingsModal (profile + the push-notification toggle), ErrorBoundary
  src/utils/    push.js (Web Push subscribe/unsubscribe), notifications.js (in-tab
                Notification API), ringtone.js (synthesized ring), iceServers.js
  public/sw.js  Service worker — app-shell caching plus the push/notificationclick
                handlers that power background call notifications
```

## Running locally
**Backend**
```bash
cd backend
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, CLOUDINARY_* keys
# optional — enables "ring when app is closed"; app runs fine without it
npx web-push generate-vapid-keys   # paste the pair into VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
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
   CORS since browsers never send one in the `Origin` header), the `CLOUDINARY_*` vars, and
   optionally `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_CONTACT_EMAIL` for background
   call notifications
4. **Frontend**: Vercel or Netlify — set `VITE_API_URL` to your backend URL. If deploying
   to Netlify, make sure `frontend/public/_redirects` (containing `/* /index.html 200`)
   is present — without it, direct links to any route other than `/` 404, since Netlify
   doesn't know client-side routes exist unless told to fall through to `index.html`
5. Video calls need HTTPS in production (`getUserMedia` requires a secure context) — Render
   and Vercel/Netlify both provide this by default

## Talking points for interviews
- **Why polling instead of WebSocket transport?** Socket.IO normally starts on HTTP
  long-polling and upgrades to a raw WebSocket once connected. On some hosting setups,
  that upgrade step specifically fails even though the underlying connection is fine — the
  giveaway is a session ID already present in a failing WebSocket URL, meaning the initial
  handshake succeeded and only the upgrade didn't. Staying on polling only trades a little
  latency for working reliably everywhere a plain HTTP request does, which matters more for
  a project other people will actually try to run than shaving milliseconds off message
  delivery.
- **The ringtone is synthesized, not an audio file** — two sine-wave oscillators via the
  Web Audio API, played in a timed pattern. No asset to host, load, or keep in sync with
  deploys. The honest caveat: browsers block audio without a prior user gesture on that
  page visit, so a genuinely cold page load with zero interaction could occasionally miss
  the first ring — acceptable for this project, worth knowing as a real constraint.
- **The 1-1 self-view PiP intentionally differs from the group grid tiles** — narrower,
  portrait-oriented, and unlabeled, matching how WhatsApp's own 1-1 call UI looks, while
  group tiles stay landscape and labeled since telling multiple people apart matters more
  there than in a 2-person call.
- **The Chats/Find People split** is worth mentioning as a UX decision, not just a code
  change — conflating "everyone" and "people you talk to" into one list is a common mistake
  in early chat-app builds, and separating them is what most production apps actually do.
- **Dark mode via CSS variables, not per-component `dark:` classes.** `paper`/`ink`/
  `surface`/`line` are Tailwind colors that resolve to CSS custom properties, which flip in
  a single `.dark` class rule. Toggling the theme re-themes the whole app without hunting
  down every component — the tradeoff is video call screens needed a separate, fixed
  `callbg` color, since those should stay dark regardless of app theme (same convention
  every calling app follows), and `ink` alone couldn't serve both roles once it became
  theme-aware.
- **Screen sharing reuses `replaceTrack`**, the exact same mechanism as camera switching —
  swap the outgoing video track on every peer connection in the room, no renegotiation. The
  one extra piece: listening for the track's own `onended` event, since the browser's
  built-in "Stop sharing" button can end a share without going through the app's UI at all.
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
- **The incoming-call payload is resolved server-side, not trusted from the client.**
  Originally the caller's own client sent its display name over the socket event; now the
  server looks the caller's `username`/avatar up from their authenticated `socket.userId`
  instead. Small, but it's the difference between "whatever the caller's browser claims" and
  an actual authorization-backed fact — the same principle as the friends-only checks
  elsewhere, just easy to miss on a field that looks cosmetic.
