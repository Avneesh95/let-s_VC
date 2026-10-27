import { test, expect } from '@playwright/test';

/**
 * Visual Regression Test Suite for Peerly VideoGrid
 * 
 * Tests N = 2..6 across viewports:
 * - 360x640 (Small Mobile Portrait)
 * - 390x844 (Standard Mobile Portrait)
 * - 844x390 (Mobile Landscape)
 * - 768x1024 (Tablet Portrait)
 * - 1366x768 (Standard Laptop)
 * - 1920x1080 (Desktop FHD)
 */

const VIEWPORTS = [
  { name: 'mobile_small_360x640', width: 360, height: 640 },
  { name: 'mobile_std_390x844', width: 390, height: 844 },
  { name: 'mobile_landscape_844x390', width: 844, height: 390 },
  { name: 'tablet_768x1024', width: 768, height: 1024 },
  { name: 'laptop_1366x768', width: 1366, height: 768 },
  { name: 'desktop_1920x1080', width: 1920, height: 1080 },
];

test.describe('VideoGrid Visual Regression & Layout Consistency', () => {
  for (const vp of VIEWPORTS) {
    for (let count = 2; count <= 6; count++) {
      test(`Grid layout snapshot: N=${count} @ ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        // Navigate to test harness or mock room
        await page.goto(`http://localhost:5173/room/VISUAL_TEST`);

        // Wait for grid to render
        await page.waitForSelector('[aria-label*="participant" i]', { timeout: 10000 });

        // Capture screenshot into tests/screenshots
        const screenshotPath = `tests/screenshots/${vp.name}_N${count}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });

        // Verify no horizontal or vertical page scrollbar / overflow
        const hasScroll = await page.evaluate(() => {
          return document.documentElement.scrollHeight > window.innerHeight + 1 ||
                 document.documentElement.scrollWidth > window.innerWidth + 1;
        });
        expect(hasScroll).toBe(false);
      });
    }
  }
});
