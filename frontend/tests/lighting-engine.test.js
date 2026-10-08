import test from "node:test";
import assert from "node:assert/strict";
import { LightingEngine } from "../lighting/LightingEngine.js";
import { mapLogicalToPhysical, normalizePhysicalFrame } from "../hardware/Arduino10LedProfile.js";

const quiet = { bass: 0.025, lowMid: 0.02, mid: 0.025, highMid: 0.018, treble: 0.012 };
const loud = { bass: 0.34, lowMid: 0.26, mid: 0.3, highMid: 0.22, treble: 0.18 };

test("lighting output is deterministic and supports configured logical counts", () => {
  for (const ledCount of [1, 8, 10, 20, 50, 256]) {
    const first = new LightingEngine({ ledCount });
    const second = new LightingEngine({ ledCount });
    for (let frame = 0; frame < 90; frame += 1) {
      const analysis = { bands: frame % 18 < 4 ? loud : quiet, overallEnergy: frame % 18 < 4 ? 0.31 : 0.03 };
      const left = first.step(analysis, frame * 16.667);
      const right = second.step(analysis, frame * 16.667);
      assert.deepEqual(left.values, right.values);
      assert.equal(left.values.length, ledCount);
      assert.ok(left.values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255));
    }
  }
});

test("steady loudness keeps headroom and an onset changes LED output", () => {
  const engine = new LightingEngine({ ledCount: 10 });
  const steady = { bands: loud, overallEnergy: 0.3 };
  let result;
  for (let frame = 0; frame < 120; frame += 1) result = engine.step(steady, frame * 16.667);
  assert.ok(result.overallEnergy < 0.9, "steady audio must not normalize itself to full scale");
  assert.ok(Math.max(...result.values) < 240, "steady audio should retain visible brightness headroom");
  const onset = engine.step({ bands: { ...loud, bass: 0.72, lowMid: 0.52 }, overallEnergy: 0.68 }, 120 * 16.667);
  assert.ok(onset.transientDetected);
  assert.notDeepEqual(onset.values, result.values);
});

test("quiet signal stays dim, mid/treble transients pulse their neighboring outputs, and beat timing is estimated only from events", () => {
  const engine = new LightingEngine({ ledCount: 10 });
  const silence = { bands: quiet, overallEnergy: 0.02 };
  let quietFrame;
  for (let frame = 0; frame < 100; frame += 1) quietFrame = engine.step(silence, frame * 16.667);
  assert.ok(Math.max(...quietFrame.values) < 60);

  const mid = engine.step({ bands: { ...quiet, mid: 0.82 }, overallEnergy: 0.2 }, 100 * 16.667);
  assert.equal(mid.transientBand, 2);
  assert.ok(mid.values.slice(3, 7).some((value) => value > 0));
  const treble = engine.step({ bands: { ...quiet, treble: 0.88 }, overallEnergy: 0.23 }, 101 * 16.667);
  assert.equal(treble.transientBand, 4);
  assert.ok(treble.values.slice(6).some((value) => value > 0));

  const beats = new LightingEngine({ ledCount: 10 });
  let beatCount = 0;
  for (let frame = 0; frame < 600; frame += 1) {
    const pulse = frame % 36 < 4;
    const output = beats.step({
      bands: { bass: pulse ? 0.8 : 0.08, lowMid: pulse ? 0.5 : 0.06, mid: 0.08, highMid: 0.03, treble: 0.02 },
      overallEnergy: pulse ? 0.55 : 0.07,
    }, frame * 16.7);
    beatCount += Number(output.beatDetected);
  }
  assert.ok(beatCount >= 8 && beatCount <= 20);
  assert.equal(beats.estimateBpm(), 100);
});

test("logical-to-physical mapping preserves the ten-pin order and quantizes digital outputs", () => {
  const mapped = mapLogicalToPhysical([0, 255]);
  assert.equal(mapped.length, 10);
  assert.deepEqual(mapped.filter((_, index) => [0, 1, 3, 4].includes(index)), [0, 0, 0, 0]);
  assert.ok(mapped.every((value, index) => [0, 1, 3, 4].includes(index) ? value === 0 || value === 255 : value >= 0 && value <= 255));
  assert.deepEqual(normalizePhysicalFrame(Array(10).fill(127)).filter((_, index) => [0, 1, 3, 4].includes(index)), [0, 0, 0, 0]);
  assert.deepEqual(normalizePhysicalFrame(Array(10).fill(128)).filter((_, index) => [0, 1, 3, 4].includes(index)), [255, 255, 255, 255]);
});

test("per-output scale values can dim or boost individual logical LEDs", () => {
  const input = { bands: loud, overallEnergy: 0.3 };
  const regular = new LightingEngine({ ledCount: 8 });
  const scaled = new LightingEngine({ ledCount: 8 });
  let regularFrame;
  let scaledFrame;
  for (let frame = 0; frame < 90; frame += 1) {
    regularFrame = regular.step(input, frame * 16.667);
    scaledFrame = scaled.step(input, frame * 16.667, { outputScales: [0.5, 2, 1, 1, 1, 1, 1, 1] });
  }
  assert.ok(scaledFrame.values[0] < regularFrame.values[0]);
  assert.ok(scaledFrame.values[1] > regularFrame.values[1]);
  assert.deepEqual(scaledFrame.values.slice(2), regularFrame.values.slice(2));
});
