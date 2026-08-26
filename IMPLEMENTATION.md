# Implementation Notes — Build & Deploy

This file documents what's in this delivery and how the pieces fit together, on top of
what's already in `README.md` (features, architecture, interview talking points).

## This pass — production hardening per the 16-phase spec

Followed the uploaded "Make this MERN Chat App a Final Production-Ready Deployable Project"
brief, but deliberately **not** the parts of it that would have meant rebuilding this from a
deliberately-small 1-1 chat app into a Discord/Slack-scale group-chat product (group
messaging, message edit/delete, emoji picker, infinite scroll, notification dropdown) — see
the note in README.md's "Production audit" section for why, and say so if that's not what you
wanted; the full-rebuild path is still on the table.

**Added:**
- **Access + refresh token auth** (`backend/utils/tokens.js`): 15-minute access tokens
  instead of a 7-day one, plus a 30-day refresh token in an httpOnly/secure/SameSite=None
  cookie (`POST /api/auth/refresh`, `POST /api/auth/logout`). The refresh token's hash (never
  the plaintext) is stored on the `User` doc and rotated on every use — a stolen-but-already-
  rotated token gets detected and kills the session server-side, not just client-side.
  `frontend/src/api/axios.js` gained a response interceptor that silently refreshes on a 401
  and retries the original request once; `AuthContext` also proactively refreshes every 12
  minutes and once on boot, so a real account's session survives closing the tab entirely —
  guest sessions are deliberately excluded (no persisted `User` doc to rotate a hash on).
- **Security middleware stack**: `helmet` (CSP off — this is a pure JSON API, not an HTML
  page), `compression`, `express-mongo-sanitize` (strips `$`/`.`-prefixed keys to block
  NoSQL-operator injection — e.g. `{"email": {"$gt": ""}}` matching the first user in the
  collection), `cookie-parser`, `morgan` (dev-format locally, combined-format piped through
  the new logger in production).
- **A real bug the mongo-sanitize testing surfaced**: sanitizing `{"$gt": ""}` out of a field
  leaves an emptied `{}` object where a string was expected, and `{}.trim()` was throwing an
  uncaught-in-spirit 500 in `/auth/login`, `/auth/register`, and `/auth/guest`. Added an
  explicit `typeof val === "string"` guard before any `.trim()` call — closes the crash and
  makes the injection attempt itself return a clean 400 instead of a stack-trace-flavored 500.
- **`ApiError`/`ApiResponse`/`logger`** (`backend/utils/`): a typed error class routes can
  `throw`, a consistent success envelope for new/refactored routes, and a timestamped logger
  wrapping `console.*` so swapping to a real logging library later is a one-file change.
  `server.js`'s global error handler now distinguishes operational errors (logged at
  warn) from unexpected ones (logged at error, full stack) instead of treating every error
  the same.
- **Rate limiting expanded** beyond just `/auth/*`: a general 300-req/15min ceiling across all
  of `/api`, plus tighter limiters on `GET /api/messages/:id` (60/min — a read endpoint, this
  mainly guards a runaway client loop) and `POST /api/upload` (30/15min — every accepted file
  is real Cloudinary bandwidth/storage).
- **`GET /api/messages/:otherUserId` capped at the most recent 300 messages** instead of
  fetching the entire, unbounded conversation history on every chat open — flagged in the
  Phase 1 audit as a real performance issue on a long-running conversation. This isn't full
  pagination (no "load older messages" UI — that's part of the scope I deliberately skipped),
  just a sane ceiling on the existing single-fetch behavior.
- **File-upload validation**: `fileFilter` on the multer instance rejects anything whose MIME
  type isn't JPEG/PNG/GIF/WEBP, so a renamed `.exe` or an `.svg` carrying an inline `<script>`
  can no longer reach Cloudinary and come back out as a URL your own users' browsers fetch —
  multer's `limits` option only checked file *size*, not content type.
- **Health check + deployment configs**: `GET /api/health` (deliberately DB-free, so a brief
  Mongo hiccup doesn't get misreported as the whole service being down), `render.yaml` at the
  repo root (Blueprint deploy — `rootDir: backend`, secrets marked `sync: false` so they're
  never committed, only prompted for in Render's dashboard), `netlify.toml` at the repo root
  (`base = "frontend"`, SPA redirect to `index.html`, a `Cache-Control: no-cache` header
  specifically on `sw.js` — a CDN-cached service worker file is the classic cause of "my
  deploy doesn't show up for users" PWA bugs).
- `NODE_ENV` is now actually read (dev vs. production logging format, cookie `Secure`/
  `SameSite` behavior) — previously declared in `.env.example` but never consulted anywhere.

**Corrects an earlier claim in this file/README from the previous pass**: `react-router-dom`
was *not* actually fully patched. The advisory active at that time reported fixed in 6.30.6;
the advisories active now (an open-redirect variant + an SSR-hydration constructor-injection
issue) have **no fix within v6** — only 7.18.2+. Left as-is rather than force a breaking v7
migration with no live browser to click through it in this sandbox; see README's "Known,
left as-is" section for the actual exploitability reasoning.

**Deliberately not changed, still**: `multer` 1.x deprecation notice (no open advisory,
compatibility with multer 2.x unverified without live Cloudinary credentials), `esbuild`'s
moderate advisory (dev-server only). Group chat, message edit/delete, emoji picker, infinite
scroll, and a notification dropdown were in the uploaded spec but skipped — see README.

## Previous pass — full production audit

Went through every backend file (routes, models, middleware, the socket layer) and every
frontend file (pages, contexts, components, utils) by hand, plus everything actually
runnable in this environment: dependency install + `npm audit` on both packages, `node
--check` on every backend `.js` file, a full `vite build`, and the backend hit live with
`curl` (guest auth, 404s, input validation, auth middleware rejection, CORS rejection of a
disallowed origin — all behaved correctly).

**Fixed:**
- `GET /api/users` was leaking every user's email address to any authenticated caller
  (including guest tokens) — removed from the response, frontend never used it.
- `cloudinary` upgraded from a vulnerable 1.x release to `2.10.1` (high-severity advisory)
  via a `package.json` `overrides` entry, since the wrapping `multer-storage-cloudinary`
  package's peer dependency hasn't caught up — verified the storage engine still constructs
  correctly against the upgraded package. Backend `npm audit`: 0 vulnerabilities.
- `AuthContext`'s `JSON.parse(localStorage.getItem("user"))` had no error handling — a
  corrupted value would crash on every load. Now falls back to logged-out state instead of
  crash-looping.

**Deliberately not changed** (see README's "Production audit" section for the reasoning):
`multer` 1.x deprecation notice (no open advisory, compatibility with multer 2.x couldn't be
verified without live Cloudinary credentials), `esbuild`'s moderate advisory (dev-server
only, not in the shipped build).

**Real limitation of this pass, worth being upfront about**: there is no MongoDB available
in this sandboxed environment (no `mongod` package in the allowed repositories, no network
route to MongoDB's own download servers) and no real Cloudinary/VAPID credentials. Every
database-backed route was verified by careful manual code review, not by actually running
requests through a live database — see the "Before you deploy" checklist in README.md for
what to run yourself before trusting this in production.

## What changed in the previous pass

1. **Minimizable calls** — `GroupCall` is now mounted once at the `App.jsx` level (outside
   `<Routes>`) instead of being tied to the `/room/:roomCode` route. Minimizing just
   navigates elsewhere in the app; the call's WebRTC connections, camera, and mic keep
   running, and the small bubble floats above whichever page you're now on.
2. **Faster 1-1 disconnect detection** — a 2-person room now uses a 1.5s grace window
   before declaring "call ended" (`DIRECT_CALL_LEAVE_GRACE_MS` in `backend/socket/socket.js`),
   down from the 8s group-call default. A *voluntary* hang-up (button, closing the tab) was
   already instant via the `pagehide` → `leave-room` path and is unaffected.
3. **Online/offline dot in the friends list** — `onlineUsers` was already being passed into
   `Sidebar.jsx` but never rendered; `ChatRow` and `PersonCard` now show it.
4. **Push notifications for messages, not just calls** — reuses the existing Web Push
   subscription (`sendWebPush` helper in `backend/socket/socket.js`); a message to someone
   with no live socket now sends a notification with sender + preview that deep-links into
   that conversation (`/chat?with=<id>`).
5. **Deployability fixes** — added `.env.example` (both apps), `.gitignore`, and
   `frontend/vercel.json` (SPA rewrite), none of which existed before despite being
   referenced by the README's setup steps.

## What was actually verified (not just read)

- `npm install` + `npm run build` on the frontend completes cleanly — confirms every
  import resolves, not just that individual files parse.
- Backend booted with dummy env vars and hit with `curl`: root route, the `/api/*` 404
  handler, and `/api/push/vapid-public-key` (503 when VAPID isn't configured) all behaved
  as expected.
- Every backend file passes `node --check`; the built frontend bundle in `dist/` passes the
  same check.

## This delivery includes a production build

`frontend/dist/` is the actual output of `npm run build`, built against the `VITE_API_URL`
already in `frontend/.env` (your deployed backend). It contains:
- Hashed, minified JS/CSS bundles
- `index.html` wired to those hashed filenames
- `manifest.json`, `sw.js`, and `icons/` copied through unchanged (needed for PWA install
  and push notifications — these are static files, not part of the JS bundle)
- `_redirects` (Netlify SPA rewrite)

**This means you can deploy the frontend by uploading `frontend/dist/` directly** to any
static host (Netlify, Vercel, S3+CloudFront, etc.) without running a build step there. If
you change `VITE_API_URL` or any other source file, you'll need to rebuild
(`cd frontend && npm install && npm run build`) — a stale `dist/` will keep pointing at
whatever backend URL it was built with.

The backend has no build step — deploy `backend/` as-is (`npm install && npm start`) to
Render, Railway, or similar.

## Before going live, verify on a real device

Everything above was checked as far as this environment allows (build tooling, HTTP
endpoints, static analysis) — there's no browser or phone here to actually place a call,
grant camera/mic permission, or receive a push notification. Test these specifically before
relying on them in production:
- Minimize a call, confirm the chat list is interactive underneath, then re-expand it
- Force-close the app mid-call on one device and time how long the other side takes to see
  "call ended" (should be ~1.5s once Socket.IO's heartbeat notices the drop — see
  README's "Detecting a dropped call" section for why that heartbeat itself has a floor)
- Enable "Notify me when app is closed" in Settings, fully close the app, and send it a
  message or call from another account
