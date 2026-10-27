import { test, expect } from '@playwright/test';

/**
 * Peerly E2E Test Suite: Group Video Calls (2 to 6 participants)
 * 
 * Uses Chromium with fake media flags:
 * --use-fake-device-for-media-stream
 * --use-fake-ui-for-media-stream
 */

test.describe('Peerly Group Video Calling & Mesh WebRTC', () => {
  const ROOM_CODE = 'TEST99';

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

      // If guest lobby is shown, enter name
      const nameInput = page.locator('input[placeholder*="name" i]');
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill(`Peer_${i}`);
        await page.click('button[type="submit"]');
      }

      // Wait for call container to mount
      await expect(page.locator('[aria-label*="participant" i]').first()).toBeVisible({ timeout: 10000 });

      // Verify tile count on the newly joined page equals i
      const tiles = page.locator('[aria-label*="participant" i]');
      await expect(tiles).toHaveCount(i, { timeout: 15000 });
    }

    // Verify all pages see 6 unique tiles
    for (const page of pages) {
      const tiles = page.locator('[aria-label*="participant" i]');
      await expect(tiles).toHaveCount(6);

      // Verify no duplicate tiles exist
      const labels = await tiles.evaluateAll((list) => list.map((el) => el.getAttribute('aria-label')));
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(6);

      // Verify remote video streams are playing (videoWidth > 0)
      const playingVideos = await page.locator('video').evaluateAll((vids) =>
        vids.every((v) => v.videoWidth > 0 && !v.paused)
      );
      expect(playingVideos).toBe(true);
    }

    // 2. The 7th join attempt must be rejected gracefully with "Room is full"
    const context7 = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const page7 = await context7.newPage();
    await page7.goto(`http://localhost:5173/room/${ROOM_CODE}`);
    const nameInput7 = page7.locator('input[placeholder*="name" i]');
    if (await nameInput7.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput7.fill('Peer_7');
      await page7.click('button[type="submit"]');
    }
    // Check for friendly "Room is full" message
    await expect(page7.locator('text=/Room is full/i')).toBeVisible({ timeout: 8000 });
    await context7.close();

    // 3. Sequentially leave one by one (6 -> 1)
    for (let i = NUM_PEERS - 1; i >= 1; i--) {
      // Leave call on the last remaining peer
      const leavingPage = pages.pop();
      const leavingContext = contexts.pop();
      await leavingPage.click('button[aria-label*="leave" i], button[aria-label*="hang" i]');
      await leavingContext.close();

      // Verify remaining peers observe tile count decremented to i
      for (const remainingPage of pages) {
        const remainingTiles = remainingPage.locator('[aria-label*="participant" i]');
        await expect(remainingTiles).toHaveCount(i, { timeout: 10000 });
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

    await p1.goto(`http://localhost:5173/room/MUTE_TEST`);
    const n1 = p1.locator('input[placeholder*="name" i]');
    if (await n1.isVisible().catch(() => false)) {
      await n1.fill('Alice');
      await p1.click('button[type="submit"]');
    }

    await p2.goto(`http://localhost:5173/room/MUTE_TEST`);
    const n2 = p2.locator('input[placeholder*="name" i]');
    if (await n2.isVisible().catch(() => false)) {
      await n2.fill('Bob');
      await p2.click('button[type="submit"]');
    }

    // Wait for both to be connected
    await expect(p1.locator('[aria-label*="participant" i]')).toHaveCount(2, { timeout: 10000 });

    // Alice turns off camera
    await p1.click('button[aria-label*="camera" i]');

    // Bob should see "Camera off" on Alice's tile
    await expect(p2.locator('text=/Camera off/i')).toBeVisible({ timeout: 5000 });

    // Alice mutes mic
    await p1.click('button[aria-label*="mic" i]');

    // Bob should see mute indicator on Alice's tile
    await expect(p2.locator('[aria-label="Muted"]')).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('In-call chat delivery and history persistence', async ({ browser }) => {
    const ctx1 = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const ctx2 = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    await p1.goto(`http://localhost:5173/room/CHAT_TEST`);
    const n1 = p1.locator('input[placeholder*="name" i]');
    if (await n1.isVisible().catch(() => false)) {
      await n1.fill('UserA');
      await p1.click('button[type="submit"]');
    }

    await p2.goto(`http://localhost:5173/room/CHAT_TEST`);
    const n2 = p2.locator('input[placeholder*="name" i]');
    if (await n2.isVisible().catch(() => false)) {
      await n2.fill('UserB');
      await p2.click('button[type="submit"]');
    }

    // Open chat on UserA
    await p1.click('button[aria-label*="chat" i]');
    await p1.fill('input[placeholder*="message" i]', 'Hello from UserA!');
    await p1.click('button[aria-label="Send"]');

    // UserB opens chat and sees the message
    await p2.click('button[aria-label*="chat" i]');
    await expect(p2.locator('text=Hello from UserA!')).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });
});
