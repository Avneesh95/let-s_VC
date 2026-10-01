import test from 'node:test';
import assert from 'node:assert/strict';
import { getCallLayoutConfig } from './callLayout.js';

test('single participant keeps a single full-call layout', () => {
  assert.equal(getCallLayoutConfig(1).mode, 'single');
  assert.equal(getCallLayoutConfig(1).desktopCols, 1);
});

test('two participants use a full-screen remote with a PiP self view', () => {
  const config = getCallLayoutConfig(2);
  assert.equal(config.mode, 'duo');
  assert.equal(config.desktopCols, 1);
  assert.equal(config.mobileRows, 2);
});

test('groups use balanced responsive grids', () => {
  assert.equal(getCallLayoutConfig(3).desktopCols, 3);
  assert.equal(getCallLayoutConfig(4).desktopCols, 2);
  assert.equal(getCallLayoutConfig(5).mobileCols, 2);
  assert.equal(getCallLayoutConfig(6).desktopRows, 2);
});
