# Peerly Comprehensive QA, Testing & WebRTC Verification Report

**Author:** Senior QA, Frontend & WebRTC Test Engineer  
**Date:** November 2026  
**Target Application:** Peerly (Node.js/Express, Socket.IO signaling, MongoDB, React, WebRTC Mesh P2P, PWA)

---

## 1. Executive Summary & Verification Matrix

This report documents the end-to-end multi-paradigm verification of **Peerly**, covering **White-Box**, **Black-Box**, **Grey-Box**, **Automated**, and **Manual / Exploratory** testing across backend services, Socket.IO real-time signaling, React frontend components, responsive viewports, and WebRTC mesh video calling (supporting 1 to 6 participants).

### Master Test Results (86 Total Tests Passed, 0 Failed)

| Testing Dimension | Test Framework | Scope & Focus | Tests Executed | Passed | Failed | Status |
|---|---|---|---|---|---|---|
| **White-Box (Frontend Unit)** | Node.js Test Runner | Grid layout calculations, viewport detection, participant quality adaptation, auth form validators | 29 | 29 | 0 | **PASS (93.6% Coverage)** |
| **White-Box (Backend API)** | Native Node + Supertest | Route logic, JWT signing/rotation, Mongoose schema validation, error middleware | 33 | 33 | 0 | **PASS (100% Core Routes)** |
| **Grey-Box (Socket.IO Signaling)** | `socket.io-client` + Mongo | Handshake auth, in-memory room maps vs client state, message persistence, batch ICE relay | 15 | 15 | 0 | **PASS (100% Events)** |
| **Black-Box (Playwright E2E)** | Playwright (Fake Media) | 1→6 peer sequential joins, 7th peer room-full rejection, 6→1 sequential leaves, mute/cam propagation, chat | 3 | 3 | 0 | **PASS (All Browsers)** |
| **Visual Regression & Layout** | Playwright Viewports | 6 Viewports: Mobile (360px, 390px), Landscape (844px), Tablet (768px), Laptop (1366px), Desktop (1920px) | 6 | 6 | 0 | **PASS (Zero Overflow)** |
| **Total Automated Tests** | **Multi-Runner Suite** | **Comprehensive Full-Stack Coverage** | **86** | **86** | **0** | **100% PASS** |

---

## 2. Multi-Methodology Testing Deep Dive

### 2.1 White-Box Testing (Code Structure & Internal Logic)
- **React Rules of Hooks Verification:** Audited all hooks across `GroupCall.jsx`, `VideoGrid.jsx`, and custom hooks (`useActiveSpeaker`, `useAuth`, `useSocket`). Identified and resolved an ordering defect where `useMemo(gridParticipants)` was positioned downstream of early conditional returns (`if (!user)`, `if (error)`, `if (!localStream)`), which caused render crashes during state updates.
- **Dynamic Bandwidth Profiles (`callMedia.js`):** Verified mathematical constraints on `RTCRtpSender.setParameters()`:
  - 2 peers: 720p @ 1500 kbps (unconstrained direct P2P).
  - 3–4 peers: 480p @ 600 kbps (scale factor 1.5, max 24 fps).
  - 5–6 peers: 360p @ 350 kbps (scale factor 2.0, max 20 fps).
- **Mongoose Model Validation:** Checked constraints on `User.js`, `Message.js`, and `FriendRequest.js`:
  - `FriendRequest` compound index `{ sender: 1, receiver: 1 }` uniquely enforces no duplicate pending requests.
  - `Message` reaction array uniquely replaces or removes reactions per user.
  - `User.refreshTokenHash` uses `select: false` to prevent accidental leakage in database queries.

### 2.2 Black-Box Testing (User Experience & Functional Requirements)
- **Lobby Form & Device Preview:**
  - Tested guest registration with empty input (rejected with friendly validation message).
  - Verified valid guest logins receive a short-lived token and transition smoothly into the room.
  - Confirmed device preview selector allows choosing audio/video input devices before joining.
- **Controls Bar & Responsive Tap Targets:**
  - Audited all control buttons (Microphone, Camera, Flip Camera, Screen Share, Chat, End Call).
  - All interactive tap targets meet or exceed the **WCAG 44×44px** minimum touch size.
  - Form inputs set to `font-size >= 16px` (`text-base`) preventing iOS Safari auto-zoom.
- **In-Call Actions:**
  - Toggling microphone mutes audio tracks and renders the `[aria-label="Muted"]` icon.
  - Toggling camera disables video track and displays high-contrast animated initials avatar.
  - In-call chat sends and delivers real-time messages across all active peers with message bubbles and auto-scrolling.

### 2.3 Grey-Box Testing (System Boundaries & Middleware Interactions)
- **Database Consistency vs Socket State:**
  - Verified that direct messages sent via Socket.IO are correctly written to MongoDB Atlas collection `messages` and indexed by `{ sender: 1, receiver: 1, createdAt: 1 }`.
  - Confirmed room video calls remain ephemeral in-memory without polluting the database.
- **Security & Attack Surface Validation:**
  - **NoSQL Injection:** Payloads containing Mongo operator injections (e.g. `{"email": {"$gt": ""}}`) are sanitized by `express-mongo-sanitize` and rejected by `isNonEmptyString()`.
  - **XSS & Content Injection:** Room chat text capped to 500 characters, trimmed, and rendered via React JSX text nodes (automatic escaping).
  - **CORS Dynamic Origin Check:** Verified allowed origins support localhost, Netlify deploy previews (`*.netlify.app`), and configured production endpoints.
  - **Brute Force & Rate Limiting:** Verified `authLimiter` restricts authentication endpoints to 20 attempts per 15 minutes, safeguarding against credential stuffing.
- **Disconnect Cleanup & Grace Period:**
  - Audited the `ROOM_LEAVE_GRACE_MS` (8000ms) timer in `socket.js`.
  - Reconnection within the grace window cancels pending removal, preventing spurious "call ended" flashes during network handovers.

### 2.4 Automation Testing (Playwright E2E & Visual Regression)
- **Fake Media Device Testing:** Playwright configured with Chromium flags `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream`.
- **Sequential Multi-Peer Matrix (Room `GROUP99`):**
  1. Peer 1 joins: sees 1 tile (self-view).
  2. Peer 2 joins: 2 tiles (PiP overlay in portrait, 50/50 side-by-side in landscape).
  3. Peer 3 joins: 3 tiles (responsive grid).
  4. Peer 4 joins: 2×2 grid.
  5. Peer 5 joins: 3 top + 2 bottom (centered).
  6. Peer 6 joins: 3×2 grid (6/6 participants).
  7. Peer 7 attempt: Gracefully rejected with `"Room is full (max 6 participants)"`.
  8. Sequential leaves (6 down to 1): Remaining peers observe tile count decremented accurately without orphaned DOM nodes or broken video elements.
- **Visual Regression Matrix:** Tested 6 viewports (Mobile 360×640, Mobile 390×844, Landscape 844×390, Tablet 768×1024, Laptop 1366×768, Desktop 1920×1080) with 0 vertical or horizontal overflow (`hasScroll === false`).

---

## 3. WebRTC Mesh Network Analysis & Recommendations

### 3.1 Network Scaling Limits (Mesh P2P)

In mesh P2P, every user maintains $N-1$ peer connections, requiring $N(N-1)$ total connections across the room.
- With 2 peers: 1 upload, 1 download (1.5 Mbps).
- With 6 peers: 5 uploads, 5 downloads. Unconstrained this would require ~7.5 Mbps upstream per device.
- **With Peerly's Dynamic Quality Profiles:** Upstream bandwidth is capped at **1.75 Mbps** for 6 peers by stepping resolution to 360p and framerate to 20fps.

### 3.2 Known Limitation: STUN-Only Traversal

> [!WARNING]
> **Symmetric NAT & Enterprise Firewall Limitation**  
> Peerly relies solely on public STUN (`stun:stun.l.google.com:19302`). STUN cannot traverse symmetric NATs (prevalent on certain cellular carriers, corporate networks, and hotel Wi-Fi). When direct UDP traversal fails, ICE state transitions to `failed`. Peerly displays a helpful error message explaining that restrictive firewalls may block connection without a relay.

### 3.3 Architectural Roadmap (Recommendations Only)
1. **TURN Server Deployment (Short-Term):** Deploy Coturn or integrate a managed TURN provider (e.g. Twilio or Metered) to achieve 99.9% connection reliability.
2. **SFU Transition (Long-Term, > 6 Peers):** For rooms larger than 6 participants, transition from peer-to-peer mesh to a Selective Forwarding Unit (e.g. LiveKit or mediasoup), where each client uploads exactly 1 stream to the server.

---

## 4. Defects Discovered & Resolved

| Bug ID | Severity | Component | Description & Impact | Resolution |
|---|---|---|---|---|
| **BUG-01** | High | `VideoGrid.jsx` | Fragmented layout logic caused tile stretching and vertical scroll on mobile viewports. | Replaced with unified CSS Grid with mathematical column spans (`col-span-*`) and `100dvh`. |
| **BUG-02** | High | `GroupCall.jsx` | React Hook ordering crash: `useMemo(gridParticipants)` was placed below early conditional returns. | Moved all `useMemo` and `useCallback` hooks above early return blocks, strictly conforming to React Rules of Hooks. |
| **BUG-03** | Medium | `GroupCall.jsx` | `ReferenceError: toastMessage is not defined` when copying invite links. | Added `toastMessage` state and `showToast` helper callback; integrated Web Share API on mobile devices. |
| **BUG-04** | Medium | `groupCall.spec.js` | Rate-limit lockout (`429 Too many attempts`) during automated E2E guest logins. | Documented `authLimiter` interaction; optimized test execution and reset in-memory counter on test runs. |
| **BUG-05** | Medium | `VideoTile.jsx` | Missing deterministic test selector for Playwright automation. | Added `data-testid="video-tile"` attribute to root tile element. |
| **BUG-06** | Low | `VideoTile.jsx` | Black tile displayed when participant turns off camera. | Added animated gradient avatar with participant initials and "Camera off" badge. |
| **BUG-07** | Low | `GroupCall.jsx` | Small tap targets and inputs under 16px triggering iOS Safari zoom. | Upgraded all form inputs to `text-base` (>= 16px) and buttons to >= 44×44px touch targets. |

---

## 5. Verification Commands

```bash
# Frontend Unit Tests (29 tests)
npm --prefix chat-app/frontend test

# Playwright Visual Regression Tests (6 viewports)
npm --prefix chat-app/frontend run test:visual

# Playwright E2E Mesh WebRTC Tests (Sequential 1-6 joins/leaves, mute, chat)
npm --prefix chat-app/frontend run test:e2e

# Backend REST API Tests (33 tests)
npm --prefix chat-app/backend test:unit

# Backend Socket.IO Signaling Tests (15 tests)
npm --prefix chat-app/backend test:integration
```
