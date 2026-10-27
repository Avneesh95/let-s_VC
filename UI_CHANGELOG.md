# Peerly UI/UX Changelog & Design System Upgrade

**Version:** 2.0.0-groupcall  
**Date:** October 2026  
**Scope:** Responsive Mobile (360–430px) & Laptop/Desktop (1024–1920px), WhatsApp/imo-Style Group Video Grid (N = 1..6), Lobby Device Selection, and Mesh WebRTC Performance Safeguards.

---

## 1. Executive Summary

Peerly has undergone a complete UI overhaul and architectural upgrade from a basic 1:1/primitive group call interface to a modern, fully responsive, production-ready WhatsApp/imo-style group video calling application. The upgrade introduces:
- A unified, auto-centering CSS Grid layout supporting **1 to 6 participants** across phone-portrait, phone-landscape, tablet, and desktop screens.
- Mobile corner-snapping Picture-in-Picture (PiP) for 1:1 calls with tap-to-swap.
- Active speaker detection with visual audio glow indicators using the Web Audio API (`AnalyserNode`).
- One-tap / long-press manual spotlight/pinning and automatic screen-share spotlight.
- In-call mobile bottom sheet chat (65vh swipeable) alongside desktop sidebar chat with automatic scrolling and unread message badges.
- Pre-call Lobby Preview with live camera/mic feedback, device enumeration, and audio level metering.
- Responsive mobile controls bar with tap-to-reveal / auto-hide, 44px+ touch targets, and iOS zoom prevention (`font-size >= 16px`).
- Mesh P2P bandwidth protection with dynamic quality profiles stepping down video resolution/bitrate as participant count increases.
- Strict WCAG AA contrast compliance and `prefers-reduced-motion` accessibility support.

---

## 2. Component Inventory & Architecture

### 2.1 New Components

| Component / Utility | File Location | Responsibility |
|---|---|---|
| `<VideoGrid>` | `src/components/VideoGrid.jsx` | Reusable 12-column CSS Grid rendering tiles for N=1..6 participants. Handles viewport detection, layout re-flow, desktop split/PiP toggles, and participant capacity limit (cap at 6). |
| `<VideoTile>` | `src/components/VideoTile.jsx` | Isolated video tile rendering local/remote streams, animated avatar fallback when camera is off, active-speaker gold glow, pin/spotlight button, connection state badges, and long-press handlers. |
| `<LobbyPreview>` | `src/components/LobbyPreview.jsx` | Pre-call device check modal allowing camera/microphone selection, permission handling, audio level visualizer bar, and camera mirroring preview. |
| `useActiveSpeaker` | `src/utils/useActiveSpeaker.js` | Custom React hook attaching an `AudioContext` and `AnalyserNode` to an audio track to compute real-time RMS/frequency averages and report active speaking state (with 450ms hold time). |
| `videoGridLayout.js` | `src/utils/videoGridLayout.js` | Pure layout engine computing Tailwind 12-column spans, row configurations, and viewport modes (`phone-portrait`, `phone-landscape`, `desktop`). 100% decoupled for deterministic unit testing. |

### 2.2 Modified Components & Views

| Component / View | File Location | Modifications |
|---|---|---|
| `GroupCall.jsx` | `src/pages/GroupCall.jsx` | Replaced legacy fragmented video rendering logic with `<VideoGrid>`. Added mobile bottom sheet chat (65vh), keyboard shortcuts (`M`, `V`, `C`), mobile Web Share API with clipboard fallback, dynamic P2P quality adaptation based on peer count, and enhanced STUN-limitation error guidance. |
| `Home.jsx` | `src/pages/Home.jsx` | Redesigned lobby view with integration of `<LobbyPreview>`, 44px+ minimum tap target sizes, iOS auto-zoom prevention (`text-base >= 16px`), responsive layout for mobile and desktop, and clean error banners. |
| `callMedia.js` | `src/utils/callMedia.js` | Added `PARTICIPANT_QUALITY_PROFILES` configuration (Duo: 720p/1500kbps, Small Group: 480p/600kbps, Large Group: 360p/350kbps) and mobile-specific capture constraints. |
| `index.css` | `src/index.css` | Injected global `prefers-reduced-motion: reduce` rules, safe-area inset styles, and smooth scrolling fallbacks. |

---

## 3. Grid Layout Specification Matrix

The grid utilizes a **12-column CSS Grid** structure to enable perfect mathematical centering and balanced visual weight without layout shifting or page scrollbars (`100dvh`, `overflow: hidden`).

```
+-----------------------------------------------------------------------------+
|                               GRID MATRIX                                    |
+-------+--------------------+---------------------+--------------------------+
| Peers | Phone Portrait     | Phone Landscape     | Desktop Landscape        |
+-------+--------------------+---------------------+--------------------------+
| N = 1 | 1 Fullscreen       | 1 Fullscreen        | 1 Fullscreen             |
| N = 2 | Remote Full + PiP  | 2 Side-by-Side (6/6)| 2 Side-by-Side (or PiP)  |
| N = 3 | 1 Full Width (12)  | 3 in a Row (4/4/4)  | 2 Top (6/6) +            |
|       | 2 Below (6/6)      |                     | 1 Centered Bottom (col 4)|
| N = 4 | 2x2 Grid (6/6/6/6) | 2x2 Grid (6/6/6/6)  | 2x2 Grid (6/6/6/6)       |
| N = 5 | 2 / 2 / 1 Bottom   | 3 Top (4/4/4) +     | 3 Top (4/4/4) +          |
|       | Centered (span 12) | 2 Centered Bottom   | 2 Centered Bottom        |
| N = 6 | 2 Cols x 3 Rows    | 3 Cols x 2 Rows     | 3 Cols x 2 Rows          |
+-------+--------------------+---------------------+--------------------------+
```

### Key Layout Behaviors:
1. **Odd-Count Balancing:** For N=3 on desktop or N=5 on landscape/desktop, the bottom row tiles use `col-start-4 col-span-6` or `col-start-3 col-span-4` to center underneath the top row rather than leaving an awkward void on the right.
2. **Dynamic Aspect Ratio & Fitting:** Camera streams render with `object-fit: cover` with rounded borders (`rounded-2xl`). Screen-share streams render with `object-fit: contain` and dark letterboxing to preserve text readability.
3. **Stream Persistence:** Stream elements retain stable keys (`participant.peerId || participant.id`). Adding or removing a peer triggers smooth CSS transitions (150–200ms) without unmounting or restarting `<video>` elements.

---

## 4. UI Polish & Mobile Experience

1. **Draggable Corner-Snapping PiP (N=2 Mobile):**
   - In 1:1 mobile portrait calls, the remote peer occupies full screen, while the local user is placed in a small floating tile (28vw × 36vw).
   - The PiP tile supports touch dragging with pointer events and snaps magnetically to the nearest screen corner upon release.
   - Tapping the PiP tile smoothly swaps the main and PiP views.

2. **Mobile Inactivity Auto-Hide Controls:**
   - On mobile viewports, the bottom call controls bar automatically hides after 3.5 seconds of inactivity to maximize video visibility.
   - A single tap anywhere on the screen immediately reveals the control bar.

3. **In-Call Chat:**
   - **Mobile:** Opens as a responsive 65vh bottom sheet modal with a rounded top (`rounded-t-3xl`) and drag handle pill, allowing the user to view the video behind it while reading messages.
   - **Desktop:** Opens as an 88-width (`w-88`) collapsible right-hand sidebar. The video grid smoothly contracts without overlapping.
   - **Auto-scroll:** New incoming messages trigger automatic scrolling to the latest message.
   - **Unread Badge:** An animated badge notifies users of unread messages when the chat panel is closed.

4. **Lobby & Pre-Call Experience:**
   - Live video preview with mic volume indicator before entering the call.
   - Dropdown selectors to enumerate and pick specific video input and audio input devices.
   - Meeting link copy toast notifications replace native browser `alert()` popups.
   - Native Web Share API integration on mobile devices with automated clipboard fallback.

5. **Accessibility & WCAG AA Compliance:**
   - All interactive touch targets maintain a minimum dimension of `44px x 44px`.
   - Form inputs maintain `font-size: 16px` (`text-base`) to prevent unwanted iOS Safari zooming.
   - All icon buttons feature explicit `aria-label` tags and `:focus-visible` outline rings.
   - Global CSS respects `@media (prefers-reduced-motion: reduce)`.

---

## 5. Mesh P2P Performance Profiles

Because Peerly utilizes a pure WebRTC mesh topology without a centralized media server, each peer maintains $N - 1$ bidirectional connections ($N(N-1)$ total peer connections across the room). To avoid saturating device CPU and upstream bandwidth, dynamic sender profiles are applied:

| Mode | Participants | Max Resolution | Max Bitrate | Scale Down Factor | Framerate |
|---|---|---|---|---|---|
| **Duo** | 2 peers | 1280x720 (720p) | 1,500 kbps | 1.0 | 30 fps |
| **Small Group** | 3–4 peers | 854x480 (480p) | 600 kbps | 1.5 | 24 fps |
| **Large Group** | 5–6 peers | 640x360 (360p) | 350 kbps | 2.0 | 20 fps |

These profiles are applied via `RTCRtpSender.setParameters()` during negotiation and dynamically adjusted as participants enter or leave the room.
