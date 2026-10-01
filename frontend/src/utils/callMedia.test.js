import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyConnectionQuality, getQualityProfile, getVideoFitMode } from './callMedia.js';

test('quality classification prioritizes severe loss and latency', () => {
  assert.equal(classifyConnectionQuality({ packetLoss: 0.5, rtt: 80, jitter: 8 }), 'good');
  assert.equal(classifyConnectionQuality({ packetLoss: 4, rtt: 120, jitter: 10 }), 'medium');
  assert.equal(classifyConnectionQuality({ packetLoss: 9, rtt: 120, jitter: 10 }), 'poor');
});

test('quality profiles reduce video load without changing audio', () => {
  assert.deepEqual(getQualityProfile('good'), {
    maxBitrate: 1500000,
    scaleResolutionDownBy: 1,
    maxFramerate: 30,
  });
  assert.ok(getQualityProfile('poor').maxBitrate < getQualityProfile('medium').maxBitrate);
  assert.ok(getQualityProfile('poor').maxFramerate < getQualityProfile('good').maxFramerate);
});

test('video fit mode preserves portrait frames and screen shares', () => {
  assert.equal(getVideoFitMode(9 / 16), 'portrait');
  assert.equal(getVideoFitMode(16 / 9), 'cover');
  assert.equal(getVideoFitMode(16 / 9, true), 'contain');
  assert.equal(getVideoFitMode(0), 'cover');
});
