/* Parent-owned oracle: public domain API only; never a mutable browser hook. */
"use strict";
const assert = require("node:assert/strict");
const ROOT =
  process.env.NEON_ROOT || require("node:path").resolve(__dirname, "../..");
const api = require(ROOT + "/engine.js");
const Engine = api.Engine || api.Neon?.Engine;
assert.ok(Engine?.create, "Documented Engine.create must exist");
const rows = [];
for (let seed = 1; seed <= 60; seed++) {
  const e = Engine.create({ seed });
  let ready = e.snapshot();
  assert.equal(ready.phase, "ready");
  e.step(1);
  assert.deepEqual(e.snapshot(), ready, "Ready cannot advance");
  e.start();
  const first = e.snapshot();
  assert.equal(first.phase, "running");
  assert.equal(first.score, 0);
  assert.equal(first.distance, 0);
  assert.equal(first.nearMisses, 0);
  // Snapshot detachment: consumers cannot move live player/traffic by editing copies.
  const detached = e.snapshot();
  detached.playerX = 123;
  if (detached.traffic?.length) detached.traffic[0].x = 123;
  assert.ok(Math.abs(e.snapshot().playerX) <= 1);
  e.setInput({ left: true, right: false, brake: false, nitro: false });
  e.step(0.25);
  let moved = e.snapshot();
  assert.ok(moved.playerX < first.playerX);
  e.pause();
  let paused = e.snapshot();
  e.step(5);
  assert.deepEqual(e.snapshot(), paused, "Pause freezes all domain values");
  e.setInput({ left: false, right: false, brake: false, nitro: false });
  e.resume();
  let maxTraffic = 0,
    frames = 0;
  for (; frames < 12000 && e.snapshot().phase === "running"; frames++) {
    const s = e.snapshot();
    // A simple normal-input avoider: choose the free lane of the nearest upcoming row.
    const approaching = s.traffic
      .filter((t) => t.z > 0)
      .sort((a, b) => a.z - b.z);
    const nearest = approaching[0];
    let target = 0;
    if (nearest) {
      const wave = approaching.filter((t) => Math.abs(t.z - nearest.z) < 8);
      const free = [-1, 0, 1].filter((x) =>
        wave.every((t) => Math.abs(t.x - x) > 0.5),
      );
      assert.ok(free.length, "Traffic wave must leave an open lane");
      target = free.sort(
        (a, b) => Math.abs(a - s.playerX) - Math.abs(b - s.playerX),
      )[0];
    }
    e.setInput({
      left: s.playerX > target + 0.025,
      right: s.playerX < target - 0.025,
      brake: frames % 311 < 20,
      nitro: frames % 197 < 60,
    });
    e.step(1 / 60);
    const n = e.snapshot();
    for (const name of [
      "elapsed",
      "distance",
      "speed",
      "score",
      "nitro",
      "nearMisses",
      "playerX",
    ])
      assert.ok(Number.isFinite(n[name]), `${name} finite`);
    assert.ok(n.nitro >= 0 && n.nitro <= 100, "Nitro strict 0..100");
    assert.ok(n.distance >= s.distance && n.elapsed >= s.elapsed);
    assert.ok(Math.abs(n.playerX) <= 1, "Road boundary");
    assert.ok(Number.isInteger(n.score) && n.score >= 0);
    assert.ok(Number.isInteger(n.nearMisses) && n.nearMisses >= 0);
    assert.ok(n.score >= s.score, "Score monotonic");
    assert.equal(
      n.score,
      Math.floor(n.distance * 2) + n.nearMisses * 150,
      "Independent documented score oracle",
    );
    assert.ok(
      n.speed >= 22 - 1e-8 && n.speed <= 84 + 1e-8,
      "Speed envelope including brake/nitro",
    );
    maxTraffic = Math.max(maxTraffic, n.traffic.length);
  }
  const final = e.snapshot();
  if (final.phase === "results") {
    e.step(5);
    assert.deepEqual(
      e.snapshot(),
      final,
      "Results cannot progress or duplicate rewards",
    );
    e.pause();
    e.resume();
    assert.deepEqual(
      e.snapshot(),
      final,
      "Pause/resume cannot resurrect crash",
    );
  }
  e.start();
  const reset = e.snapshot();
  assert.equal(reset.score, 0);
  assert.equal(reset.distance, 0);
  assert.equal(reset.nearMisses, 0);
  assert.equal(reset.phase, "running");
  rows.push({
    seed,
    frames,
    phase: final.phase,
    distance: final.distance,
    score: final.score,
    nearMisses: final.nearMisses,
    maxTraffic,
  });
}
// Identical seed, real time and inputs must give identical domain snapshots.
for (let seed = 1; seed <= 10; seed++) {
  const a = Engine.create({ seed }),
    b = Engine.create({ seed });
  a.start();
  b.start();
  for (let i = 0; i < 360; i++) {
    const input = {
      left: i % 90 < 15,
      right: i % 90 > 75,
      brake: i % 131 < 30,
      nitro: i % 79 < 35,
    };
    a.setInput(input);
    b.setInput(input);
    a.step(1 / 60);
    b.step(1 / 60);
    assert.deepEqual(a.snapshot(), b.snapshot());
  }
}
// Independent traffic lookahead inequality includes the full longitudinal contact zone.
const C = api.CONFIG;
assert.ok(
  C.waveSpacing / (C.maxSpeed - C.trafficSpeed) >
    2 / C.steerRate + (2 * C.contactLength) / (C.maxSpeed - C.trafficSpeed),
);
for (let seed = 1; seed <= 20; seed++) {
  const e = Engine.create({ seed });
  e.start();
  for (let i = 0; i < 2400 && e.snapshot().phase === "running"; i++)
    e.step(0.05);
  const s = e.snapshot();
  assert.equal(
    s.phase,
    "results",
    "A seeded straight-line run must actually crash",
  );
  assert.ok(s.crash, "Crash must be an actual domain result");
  assert.equal(
    s.nearMisses,
    0,
    "Driving far from lane-centered cars cannot farm near misses",
  );
  e.step(0.25);
  assert.deepEqual(e.snapshot(), s);
}
const n = Engine.create({ seed: 123 });
n.start();
n.setInput({ nitro: true });
for (let i = 0; i < 30; i++) n.step(1 / 60);
assert.ok(
  n.snapshot().nitro < C.initialNitro,
  "Real active boosting must consume nitro",
);
assert.ok(n.snapshot().speed > C.startSpeed, "Boost must change actual motion");
n.setInput({ brake: true, nitro: true });
const reserve = n.snapshot().nitro;
for (let i = 0; i < 30; i++) n.step(1 / 60);
assert.equal(n.snapshot().nitro, reserve, "Brake priority cannot drain nitro");
// Different reference algorithm: enumerate rectangle-face crossing candidates.
let fuzz = 0,
  rand = 314159;
const rng = () =>
  (rand = (Math.imul(rand, 1664525) + 1013904223) >>> 0) / 4294967296;
for (let i = 0; i < 10000; i++) {
  const x0 = rng() * 4 - 2,
    z0 = rng() * 60 - 30,
    x1 = rng() * 4 - 2,
    z1 = rng() * 60 - 30;
  const inside = (t) =>
    Math.abs(x0 + (x1 - x0) * t) <= 0.33 + 1e-10 &&
    Math.abs(z0 + (z1 - z0) * t) <= 4.4 + 1e-10;
  const candidates = [0, 1];
  for (const [a, b, r] of [
    [x0, x1, 0.33],
    [z0, z1, 4.4],
  ])
    if (Math.abs(b - a) > 1e-14)
      for (const side of [-r, r]) candidates.push((side - a) / (b - a));
  const valid = candidates.filter((t) => t >= 0 && t <= 1 && inside(t));
  const expected = valid.length ? Math.min(...valid) : null;
  const actual = api.sweepContact(x0, z0, x1, z1);
  if (expected === null) assert.equal(actual, null);
  else assert.ok(actual !== null && Math.abs(actual - expected) < 1e-8);
  fuzz++;
}
const pass = Engine.create({ seed: 7 });
pass.start();
pass.setInput({ right: true });
pass.step(0.25);
pass.setInput({});
assert.ok(Math.abs(pass.snapshot().playerX - 0.4) < 1e-8);
for (let i = 0; i < 1000 && !pass.snapshot().traffic.some((t) => t.passed); i++)
  pass.step(0.02);
const narrow = pass.snapshot();
assert.equal(narrow.phase, "running");
assert.equal(narrow.nearMisses, 1);
assert.equal(narrow.nitro, 71);
for (let i = 0; i < 10; i++) pass.step(0.01);
assert.equal(pass.snapshot().nearMisses, 1);
console.log(
  JSON.stringify(
    {
      seeds: rows.length,
      determinismSeeds: 10,
      straightCrashSeeds: 20,
      sweptContactCases: fuzz,
      narrowPass: { nearMisses: narrow.nearMisses, nitro: narrow.nitro },
      runs: rows,
    },
    null,
    2,
  ),
);
