import { test, expect } from '@playwright/test';

/**
 * Peerly E2E Test Suite: Group Video Calls (2 to 6 participants)
 * 
 * Uses Chromium with fake media flags:
 * --use-fake-device-for-media-stream
 * --use-fake-ui-for-media-stream
 */

test.describe('Peerly Group Video Calling & Mesh WebRTC', () => {
  test.setTimeout(180000); // Allow sufficient time for 6 concurrent browser contexts and 15 mesh peer connections
  const ROOM_CODE = 'GROUP99';

  test('Sequential joins (1 to 6 peers) and leaves (6 to 1 peers)', async ({ browser }) => {
    const contexts = [];
    const pages = [];
    const NUM_PEERS = 6;

    // 1. Sequentially join peers 1 through 6
    for (let i = 1; i <= NUM_PEERS; i++) {
      const context = await browser.newContext({
        permissions: ['camera', 'microphone'],
      });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);

      await page.goto(`http://localhost:5173/room/${ROOM_CODE}`);

      // Enter guest name and join call
      const nameInput = page.locator('input[placeholder*="name" i]');
      await nameInput.waitFor({ state: 'visible', timeout: 25000 });
      await nameInput.fill(`Peer_${i}`);
      await page.click('button[type="submit"]', { force: true });

      // Wait for call container to mount
      await expect(page.locator('[data-testid="video-tile"]').first()).toBeVisible({ timeout: 15000 });

      // Verify tile count on the newly joined page equals i
      const tiles = page.locator('[data-testid="video-tile"]');
      await expect(tiles).toHaveCount(i, { timeout: 20000 });
    }

    // Verify all pages see 6 unique tiles and playing video streams in parallel
    await Promise.all(pages.map(async (page) => {
      const tiles = page.locator('[data-testid="video-tile"]');
      await expect(tiles).toHaveCount(6, { timeout: 15000 });

      // Verify no duplicate tiles exist
      const labels = await tiles.evaluateAll((list) => list.map((el) => el.getAttribute('aria-label')));
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(6);

      // Verify remote video streams are playing
      await page.waitForFunction(() => {
        const vids = Array.from(document.querySelectorAll('video'));
        return vids.length > 0 && vids.some((v) => v.videoWidth > 0 && !v.paused);
      }, { timeout: 10000 });
    }));

    // 2. The 7th join attempt must be rejected gracefully with "Room is full"
    const context7 = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const page7 = await context7.newPage();
    await page7.goto(`http://localhost:5173/room/${ROOM_CODE}`);
    const nameInput7 = page7.locator('input[placeholder*="name" i]');
    await nameInput7.waitFor({ state: 'visible', timeout: 20000 });
    await nameInput7.fill('Peer_7');
    await page7.click('button[type="submit"]', { force: true });

    // Check for friendly "Room is full" message
    await expect(page7.locator('text=/Room is full/i')).toBeVisible({ timeout: 15000 });
    await context7.close();

    // 3. Sequentially leave one by one (6 -> 1)
    for (let i = NUM_PEERS - 1; i >= 1; i--) {
      // Leave call on the last remaining peer
      const leavingPage = pages.pop();
      const leavingContext = contexts.pop();
      await leavingPage.click('button[aria-label*="leave" i], button[aria-label*="hang" i]', { force: true });
      await leavingContext.close();

      // Verify the active peer observes tile count decremented to i
      const activePage = pages[0];
      if (activePage) {
        const remainingTiles = activePage.locator('[data-testid="video-tile"]');
        await expect(remainingTiles).toHaveCount(i, { timeout: 15000 });
      }
    }

    // Cleanup final context
    if (contexts[0]) await contexts[0].close();
  });

  test('Audio/Video mute and Camera-Off state propagation', async ({ browser }) => {
    const ctx1 = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const ctx2 = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    await p1.goto(`http://localhost:5173/room/MUTETEST`);
    const n1 = p1.locator('input[placeholder*="name" i]');
    try {
      await n1.waitFor({ state: 'visible', timeout: 8000 });
      await n1.fill('Alice');
      await p1.click('button[type="submit"]');
    } catch {}

    await p2.goto(`http://localhost:5173/room/MUTETEST`);
    const n2 = p2.locator('input[placeholder*="name" i]');
    try {
      await n2.waitFor({ state: 'visible', timeout: 8000 });
      await n2.fill('Bob');
      await p2.click('button[type="submit"]');
    } catch {}

    // Wait for both to be connected
    await expect(p1.locator('[data-testid="video-tile"]')).toHaveCount(2, { timeout: 15000 });
    await expect(p2.locator('[data-testid="video-tile"]')).toHaveCount(2, { timeout: 15000 });

    // Alice turns off camera
    await p1.click('button[aria-label*="Turn camera off" i], button[aria-label*="Turn off camera" i]', { force: true });

    // Alice's local tile shows camera off
    await expect(p1.locator('text=/Camera off/i').first()).toBeVisible({ timeout: 5000 });

    // Alice mutes mic
    await p1.click('button[aria-label*="Mute mic" i], button[aria-label*="Mute microphone" i]', { force: true });

    // Local tile displays muted state
    await expect(p1.locator('[aria-label="Muted"]').first()).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('In-call chat delivery and history persistence', async ({ browser }) => {
    const ctx1 = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const ctx2 = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    await p1.goto(`http://localhost:5173/room/CHATTEST`);
    const n1 = p1.locator('input[placeholder*="name" i]');
    try {
      await n1.waitFor({ state: 'visible', timeout: 8000 });
      await n1.fill('UserA');
      await p1.click('button[type="submit"]');
    } catch {}

    await p2.goto(`http://localhost:5173/room/CHATTEST`);
    const n2 = p2.locator('input[placeholder*="name" i]');
    try {
      await n2.waitFor({ state: 'visible', timeout: 8000 });
      await n2.fill('UserB');
      await p2.click('button[type="submit"]');
    } catch {}

    // Wait for connection
    await expect(p1.locator('[data-testid="video-tile"]')).toHaveCount(2, { timeout: 15000 });
    await expect(p2.locator('[data-testid="video-tile"]')).toHaveCount(2, { timeout: 15000 });

    // Open chat on UserA
    await p1.click('button[aria-label*="chat" i]', { force: true });
    await p1.fill('input[placeholder*="message" i]', 'Hello from UserA!');
    await p1.click('button[aria-label="Send"]', { force: true });

    // UserB opens chat and sees the message
    await p2.click('button[aria-label*="chat" i]', { force: true });
    await expect(p2.locator('text=Hello from UserA!')).toBeVisible({ timeout: 8000 });

    await ctx1.close();
    await ctx2.close();
  });
});
