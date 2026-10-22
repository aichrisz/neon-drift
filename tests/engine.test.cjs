const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Engine, CONFIG } = require("../engine.js");
test("state/motion tracer and detached snapshots", () => {
  const e = Engine.create({ seed: 7 });
  assert.equal(e.snapshot().phase, "ready");
  e.start();
  e.step(1);
  assert(e.snapshot().distance > 0);
  const a = e.snapshot();
  assert(Object.isFrozen(a));
  assert(Object.isFrozen(a.traffic));
  assert(Object.isFrozen(a.traffic[0]));
  assert(e.snapshot().traffic.length > 0);
  e.pause();
  const p = e.snapshot();
  e.step(1);
  assert.deepEqual(e.snapshot(), p);
  e.resume();
  e.step(0.1);
  assert(e.snapshot().distance > p.distance);
  e.start();
  assert.equal(e.snapshot().distance, 0);
});
test("immutable config, fairness inequality, bounded steering and validation", () => {
  assert(Object.isFrozen(CONFIG));
  const reaction = 2 / CONFIG.steerRate;
  const required =
    (CONFIG.maxSpeed - 16) * reaction + 2 * 5.2;
  assert(CONFIG.waveSpacing > required);
  assert(CONFIG.spawnZ > required);
  const e = Engine.create({ seed: 42 });
  e.start();
  e.setInput({ left: true });
  for (let i = 0; i < 60; i++) e.step(1 / 60);
  assert.equal(e.snapshot().playerX, -1);
  e.setInput({ left: true, right: true });
  e.step(0.1);
  assert.equal(e.snapshot().playerX, -1);
  for (const d of [-1, NaN, Infinity, "1"]) assert.throws(() => e.step(d));
  assert.throws(() => e.setInput({ nitro: 1 }));
  assert.throws(() => Engine.create({ seed: NaN }));
  const before = e.snapshot();
  e.step(0);
  assert.deepEqual(e.snapshot(), before);
});
test("seeded waves leave open lane; deterministic across 100 seeds", () => {
  for (let seed = 0; seed < 100; seed++) {
    const a = Engine.create({ seed }),
      b = Engine.create({ seed });
    a.start();
    b.start();
    for (let i = 0; i < 50; i++) {
      a.step(0.1);
      b.step(0.1);
    }
    assert.deepEqual(a.snapshot(), b.snapshot());
    const waves = new Map();
    for (const c of a.snapshot().traffic) {
      const k = c.wave;
      waves.set(k, (waves.get(k) || 0) + 1);
    }
    assert([...waves.values()].every((n) => n <= 2));
    assert(a.snapshot().traffic.length <= CONFIG.maxTraffic);
  }
});
