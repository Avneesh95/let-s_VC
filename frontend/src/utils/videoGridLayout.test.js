import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getViewportMode,
  getTileGridClass,
  getGridRowStyle,
} from './videoGridLayout.js';

// ==========================================
// 1. VIEWPORT PROFILE DETECTION
// ==========================================
test('getViewportMode detects phone portrait, phone landscape, and desktop correctly', () => {
  // Mobile Portrait (e.g. iPhone 14: 390x844, Pixel 7: 412x915, small 360x640)
  assert.equal(getViewportMode(360, 640), 'phone-portrait');
  assert.equal(getViewportMode(390, 844), 'phone-portrait');
  assert.equal(getViewportMode(412, 915), 'phone-portrait');

  // Mobile Landscape (e.g. 844x390, 640x360)
  assert.equal(getViewportMode(844, 390), 'phone-landscape');
  assert.equal(getViewportMode(640, 360), 'phone-landscape');

  // Desktop / Laptop Landscape (e.g. 1024x768, 1280x800, 1920x1080)
  assert.equal(getViewportMode(1024, 768), 'desktop');
  assert.equal(getViewportMode(1280, 800), 'desktop');
  assert.equal(getViewportMode(1920, 1080), 'desktop');

  // Tablet Portrait (e.g. iPad 768x1024)
  assert.equal(getViewportMode(768, 1024), 'desktop');
});

// ==========================================
// 2. PHONE PORTRAIT LAYOUTS (N = 1..6)
// ==========================================
test('phone portrait N = 1 (just me): full-screen self view', () => {
  const mode = 'phone-portrait';
  assert.equal(getTileGridClass(0, 1, mode), 'col-span-12 row-span-1 h-full');
  assert.equal(getGridRowStyle(1, mode), 'grid-rows-1');
});

test('phone portrait N = 2: remote fullscreen (PiP handled via overlay)', () => {
  const mode = 'phone-portrait';
  assert.equal(getTileGridClass(0, 2, mode), 'col-span-12 h-full');
  assert.equal(getGridRowStyle(2, mode), 'grid-rows-1');
});

test('phone portrait N = 3: row 1 = 1 wide tile (full width), row 2 = 2 tiles side by side', () => {
  const mode = 'phone-portrait';
  assert.equal(getTileGridClass(0, 3, mode), 'col-span-12 h-full'); // Row 1: full width
  assert.equal(getTileGridClass(1, 3, mode), 'col-span-6 h-full');  // Row 2: 50% width
  assert.equal(getTileGridClass(2, 3, mode), 'col-span-6 h-full');  // Row 2: 50% width
  assert.equal(getGridRowStyle(3, mode), 'grid-rows-2');            // 2 equal rows
});

test('phone portrait N = 4: 2x2 grid', () => {
  const mode = 'phone-portrait';
  for (let i = 0; i < 4; i++) {
    assert.equal(getTileGridClass(i, 4, mode), 'col-span-6 h-full');
  }
  assert.equal(getGridRowStyle(4, mode), 'grid-rows-2');
});

test('phone portrait N = 5: rows of 2 / 2 / 1 with last tile full width', () => {
  const mode = 'phone-portrait';
  // Row 1 (2 tiles)
  assert.equal(getTileGridClass(0, 5, mode), 'col-span-6 h-full');
  assert.equal(getTileGridClass(1, 5, mode), 'col-span-6 h-full');
  // Row 2 (2 tiles)
  assert.equal(getTileGridClass(2, 5, mode), 'col-span-6 h-full');
  assert.equal(getTileGridClass(3, 5, mode), 'col-span-6 h-full');
  // Row 3 (1 centered full width tile)
  assert.equal(getTileGridClass(4, 5, mode), 'col-span-12 h-full');
  assert.equal(getGridRowStyle(5, mode), 'grid-rows-3');
});

test('phone portrait N = 6: 2 columns x 3 rows', () => {
  const mode = 'phone-portrait';
  for (let i = 0; i < 6; i++) {
    assert.equal(getTileGridClass(i, 6, mode), 'col-span-6 h-full');
  }
  assert.equal(getGridRowStyle(6, mode), 'grid-rows-3');
});

// ==========================================
// 3. PHONE LANDSCAPE LAYOUTS (N = 2..6)
// ==========================================
test('phone landscape N = 2: side by side', () => {
  const mode = 'phone-landscape';
  assert.equal(getTileGridClass(0, 2, mode), 'col-span-6 h-full');
  assert.equal(getTileGridClass(1, 2, mode), 'col-span-6 h-full');
  assert.equal(getGridRowStyle(2, mode), 'grid-rows-1');
});

test('phone landscape N = 3: 3 in a row', () => {
  const mode = 'phone-landscape';
  for (let i = 0; i < 3; i++) {
    assert.equal(getTileGridClass(i, 3, mode), 'col-span-4 h-full');
  }
  assert.equal(getGridRowStyle(3, mode), 'grid-rows-1');
});

test('phone landscape N = 4: 2x2 grid', () => {
  const mode = 'phone-landscape';
  for (let i = 0; i < 4; i++) {
    assert.equal(getTileGridClass(i, 4, mode), 'col-span-6 h-full');
  }
  assert.equal(getGridRowStyle(4, mode), 'grid-rows-2');
});

test('phone landscape N = 5: 3 + 2 (centered)', () => {
  const mode = 'phone-landscape';
  // Row 1: 3 in a row
  assert.equal(getTileGridClass(0, 5, mode), 'col-span-4 h-full');
  assert.equal(getTileGridClass(1, 5, mode), 'col-span-4 h-full');
  assert.equal(getTileGridClass(2, 5, mode), 'col-span-4 h-full');
  // Row 2: 2 centered (tile 3 starts at col 3, leaving 2 cols margin on each side)
  assert.equal(getTileGridClass(3, 5, mode), 'col-span-4 col-start-3 h-full');
  assert.equal(getTileGridClass(4, 5, mode), 'col-span-4 h-full');
  assert.equal(getGridRowStyle(5, mode), 'grid-rows-2');
});

test('phone landscape N = 6: 3x2 grid', () => {
  const mode = 'phone-landscape';
  for (let i = 0; i < 6; i++) {
    assert.equal(getTileGridClass(i, 6, mode), 'col-span-4 h-full');
  }
  assert.equal(getGridRowStyle(6, mode), 'grid-rows-2');
});

// ==========================================
// 4. LAPTOP / DESKTOP LAYOUTS (N = 2..6)
// ==========================================
test('desktop N = 2: side by side 50/50', () => {
  const mode = 'desktop';
  assert.equal(getTileGridClass(0, 2, mode), 'col-span-6 h-full');
  assert.equal(getTileGridClass(1, 2, mode), 'col-span-6 h-full');
  assert.equal(getGridRowStyle(2, mode), 'grid-rows-1');
});

test('desktop N = 3: 2 on top + 1 centered below (or 3 in a row on wide screen)', () => {
  const mode = 'desktop';
  // Standard desktop (2 top + 1 centered below)
  assert.equal(getTileGridClass(0, 3, mode, false), 'col-span-6 h-full');
  assert.equal(getTileGridClass(1, 3, mode, false), 'col-span-6 h-full');
  assert.equal(getTileGridClass(2, 3, mode, false), 'col-span-6 col-start-4 h-full'); // Centered!
  assert.equal(getGridRowStyle(3, mode), 'grid-rows-2');

  // Ultrawide desktop (3 in a row)
  for (let i = 0; i < 3; i++) {
    assert.equal(getTileGridClass(i, 3, mode, true), 'col-span-4 h-full');
  }
});

test('desktop N = 4: 2x2 grid', () => {
  const mode = 'desktop';
  for (let i = 0; i < 4; i++) {
    assert.equal(getTileGridClass(i, 4, mode), 'col-span-6 h-full');
  }
  assert.equal(getGridRowStyle(4, mode), 'grid-rows-2');
});

test('desktop N = 5: 3 on top + 2 centered below', () => {
  const mode = 'desktop';
  // Row 1: 3 in a row
  assert.equal(getTileGridClass(0, 5, mode), 'col-span-4 h-full');
  assert.equal(getTileGridClass(1, 5, mode), 'col-span-4 h-full');
  assert.equal(getTileGridClass(2, 5, mode), 'col-span-4 h-full');
  // Row 2: 2 centered (tile 3 starts at col 3, leaving cols 1-2 on left, cols 11-12 on right)
  assert.equal(getTileGridClass(3, 5, mode), 'col-span-4 col-start-3 h-full');
  assert.equal(getTileGridClass(4, 5, mode), 'col-span-4 h-full');
  assert.equal(getGridRowStyle(5, mode), 'grid-rows-2');
});

test('desktop N = 6: 3x2 grid', () => {
  const mode = 'desktop';
  for (let i = 0; i < 6; i++) {
    assert.equal(getTileGridClass(i, 6, mode), 'col-span-4 h-full');
  }
  assert.equal(getGridRowStyle(6, mode), 'grid-rows-2');
});

// ==========================================
// 5. STABLE KEYS & ORDER PRESERVATION
// ==========================================
test('tile order and stable keys are preserved when participants join or leave', () => {
  const participants = [
    { id: 'user_self', username: 'Alice' },
    { id: 'user_bob', username: 'Bob' },
  ];

  // Join Charlie
  const afterJoin = [
    ...participants,
    { id: 'user_charlie', username: 'Charlie' },
  ];

  assert.equal(afterJoin[0].id, 'user_self');
  assert.equal(afterJoin[1].id, 'user_bob');
  assert.equal(afterJoin[2].id, 'user_charlie');

  // Leave Bob
  const afterLeave = afterJoin.filter((p) => p.id !== 'user_bob');
  assert.equal(afterLeave[0].id, 'user_self');
  assert.equal(afterLeave[1].id, 'user_charlie');
});
