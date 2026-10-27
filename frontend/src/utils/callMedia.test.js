import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyConnectionQuality,
  getQualityProfile,
  getVideoFitMode,
  PARTICIPANT_QUALITY_PROFILES,
  getQualityProfileByParticipantCount,
} from './callMedia.js';

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

test('participant count quality profiles dynamically scale down bandwidth for mesh P2P', () => {
  const duo = getQualityProfileByParticipantCount(2);
  const smallGroup = getQualityProfileByParticipantCount(3);
  const largeGroup = getQualityProfileByParticipantCount(6);

  assert.equal(duo.maxBitrate, 1500000);
  assert.equal(duo.scaleResolutionDownBy, 1.0);
  assert.equal(duo.maxFramerate, 30);

  assert.equal(smallGroup.maxBitrate, 600000);
  assert.equal(smallGroup.scaleResolutionDownBy, 1.5);
  assert.equal(smallGroup.maxFramerate, 24);

  assert.equal(largeGroup.maxBitrate, 350000);
  assert.equal(largeGroup.scaleResolutionDownBy, 2.0);
  assert.equal(largeGroup.maxFramerate, 20);

  // Assert monotonic reduction
  assert.ok(duo.maxBitrate > smallGroup.maxBitrate);
  assert.ok(smallGroup.maxBitrate > largeGroup.maxBitrate);
  assert.ok(duo.scaleResolutionDownBy < smallGroup.scaleResolutionDownBy);
  assert.ok(smallGroup.scaleResolutionDownBy < largeGroup.scaleResolutionDownBy);
});

test('video fit mode preserves portrait frames and screen shares', () => {
  assert.equal(getVideoFitMode(9 / 16), 'portrait');
  assert.equal(getVideoFitMode(16 / 9), 'cover');
  assert.equal(getVideoFitMode(16 / 9, true), 'contain');
  assert.equal(getVideoFitMode(0), 'cover');
});
