# Implementation Notes — Build & Deploy

This file documents what's in this delivery and how the pieces fit together, on top of
what's already in `README.md` (features, architecture, interview talking points).

## What changed in this pass

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
