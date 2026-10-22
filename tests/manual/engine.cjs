/* v1.0 parent oracle adapted explicitly to the approved v1.1 contracts.
   Independent geometry/reward arithmetic; public instances, never a live hook. */
"use strict";
const assert = require("node:assert/strict");
const ROOT =
  process.env.NEON_ROOT || require("node:path").resolve(__dirname, "../..");
const api = require(ROOT + "/engine.js");
const Engine = api.Engine || api.Neon?.Engine;
assert.ok(Engine?.create, "Documented Engine.create must exist");
const rows = [];
const dimensions = {compact:[.28,3.8,22],sedan:[.34,4.4,20],van:[.46,6,16]};
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
for (const mode of ['normal','hard'])
for (let seed = 1; seed <= 60; seed++) {
  const e = Engine.create({ seed, mode });
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
  assert(Object.isFrozen(detached));
  assert.throws(()=>{detached.playerX = 123;},TypeError);
  assert.throws(()=>{detached.traffic[0].x = 123;},TypeError);
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
  let bonus=0,count=0,combo=0,bestCombo=0,lastPass=-Infinity;
  const clearance=new Map(),rewarded=new Set(),types=new Set(),offsets=new Set();
  const endTime=e.snapshot().elapsed+200;
  for (; frames < 26000 && e.snapshot().elapsed < endTime-1e-9 && e.snapshot().phase === "running"; frames++) {
    const s = e.snapshot();
    // A simple normal-input avoider: choose the free lane of the nearest upcoming row.
    const approaching = s.traffic
      .filter((t) => t.z >= -(4.4+t.length)/2-.1)
      .sort((a, b) => a.z - b.z);
    const nearest = approaching[0];
    let target = 0;
    if (nearest) {
      const wave = approaching.filter((t) => t.wave === nearest.wave);
      const free = [-1, 0, 1].filter((x) =>
        wave.every((t) => Math.abs(t.x - x) > 0.5),
      );
      assert.ok(free.length, "Traffic wave must leave an open lane");
      target = free.sort(
        (a, b) => Math.abs(a - s.playerX) - Math.abs(b - s.playerX),
      )[0];
      if(seed%2){
        const close=wave.flatMap(t=>[-1,1].map(side=>t.x+side*((.32+t.width)/2+.08)))
          .filter(x=>Math.abs(x)<=1&&wave.every(t=>Math.abs(t.x-x)>(.32+t.width)/2+.04));
        target=close.sort((a,b)=>Math.abs(a-s.playerX)-Math.abs(b-s.playerX))[0]??target;
      }
    }
    e.setInput({
      left: s.playerX > target + 0.007,
      right: s.playerX < target - 0.007,
      brake: frames % 311 < 20,
      nitro: frames % 197 < 60,
    });
    // Split the CALL at exact nitro exhaustion as the documented integrator
    // does internally. Each observed segment then has one mean velocity and
    // one endpoint event time; no tolerance hides within-call reward timing.
    const boosting=frames%197<60&&!(frames%311<20)&&s.nitro>1e-10;
    const dt=Math.min(1/120,endTime-s.elapsed,boosting?s.nitro/26:Infinity);
    e.step(dt);
    const n = e.snapshot();
    assert.equal(n.phase,'running',`successful avoider ${mode}/${seed} at ${n.elapsed}`);
    // Independent pass oracle: integrate clearance through the full actual-length
    // zone from consecutive public positions, not event bonus/combo output.
    let awards=0;
    for(const old of s.traffic){
      const t=n.traffic.find(t=>t.id===old.id);if(!t)continue;
      const [width,length,desired]=dimensions[t.type];
      assert.equal(t.width,width);assert.equal(t.length,length);assert(t.speed>=16-1e-7&&t.speed<=desired+1e-7);
      types.add(t.type);offsets.add(Math.round((t.x-Math.round(t.x))*100));
      const rx=(.32+width)/2,rz=(4.4+length)/2;
      if(old.z>=-rz&&t.z<=rz){
        const depth=old.z-t.z,a=clamp((old.z-rz)/depth,0,1),b=clamp((old.z+rz)/depth,0,1);
        const x=s.playerX+(n.playerX-s.playerX)*a-t.x,y=s.playerX+(n.playerX-s.playerX)*b-t.x;
        clearance.set(t.id,Math.min(clearance.get(t.id)??Infinity,x*y<=0?0:Math.min(Math.abs(x),Math.abs(y))));
      }
      if(!old.passed&&t.z < -rz){
        const gap=clearance.get(t.id)??Infinity;
        if(gap>rx&&gap<=rx+.16){
          assert(!rewarded.has(t.id));rewarded.add(t.id);awards++;
          combo=n.elapsed-lastPass<8?combo+1:1;lastPass=n.elapsed;bestCombo=Math.max(bestCombo,combo);
          bonus+=150*Math.min(4,combo);count++;

        }
      }
    }
    // Two same-wave cars can reward in one step. Snapshot exposes the LAST
    // event, so inspect it after independently accumulating both crossings.
    if(awards){assert.equal(n.lastNearMiss.id,count);assert.equal(n.lastNearMiss.elapsed,n.elapsed);}
    assert.equal(n.nearMisses,count);assert.equal(n.nearMissBonus,bonus);
    assert.equal(n.combo,n.elapsed-lastPass<8?combo:0);
    assert.equal(n.multiplier,n.elapsed-lastPass<8?Math.min(4,combo):1);
    assert.equal(n.bestCombo,bestCombo);
    assert(Math.abs(n.comboRemaining-Math.max(0,8-(n.elapsed-lastPass)))<1e-8);
    const drained=(frames%197<60&&!(frames%311<20))?26*(n.elapsed-s.elapsed):0;
    assert(Math.abs(n.nitro-Math.min(100,Math.max(0,s.nitro-drained)+16*awards))<1e-7);
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
      Math.floor(n.distance * 2) + bonus,
      "Independent documented score oracle",
    );
    assert.ok(
      n.speed >= 22 - 1e-8 && n.speed <= 84 + 1e-8,
      "Speed envelope including brake/nitro",
    );
    maxTraffic = Math.max(maxTraffic, n.traffic.length);
  }
  const final = e.snapshot();
  assert(Math.abs(final.elapsed-endTime)<1e-8);assert.equal(final.phase,'running');
  assert.equal(types.size,3);assert.equal(offsets.size,3);assert(maxTraffic<=10);
  if(seed%2)assert(count>=4&&bestCombo>=2,'close-driver actually exercises combo rewards');
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
    mode,
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
for (const mode of ['normal','hard'])
for (let seed = 1; seed <= 10; seed++) {
  const a = Engine.create({ seed, mode }),
    b = Engine.create({ seed, mode });
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
  108 > (84-16)*(2/1.6)+2*((4.4+6)/2),
);
assert(C.spawnZ>(84-16)*(2/1.6)+2*5.2);
for (const mode of ['normal','hard'])
for (let seed = 1; seed <= 20; seed++) {
  const e = Engine.create({ seed, mode });
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
  const hit=s.traffic.find(t=>t.id===s.crash.id);
  assert(Math.abs(hit.z-(4.4+hit.length)/2)<1e-7,'actual type contact boundary');
  assert.equal(s.nearMissBonus,0);assert.equal(s.lastNearMiss,null);
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
for(const [rx,rz] of [[.33,4.4],[(.32+.28)/2,(4.4+3.8)/2],[(.32+.34)/2,(4.4+4.4)/2],[(.32+.46)/2,(4.4+6)/2]])
for (let i = 0; i < 10000; i++) {
  const x0 = rng() * 4 - 2,
    z0 = rng() * 60 - 30,
    x1 = rng() * 4 - 2,
    z1 = rng() * 60 - 30;
  const inside = (t) =>
    Math.abs(x0 + (x1 - x0) * t) <= rx + 1e-10 &&
    Math.abs(z0 + (z1 - z0) * t) <= rz + 1e-10;
  const candidates = [0, 1];
  for (const [a, b, r] of [
    [x0, x1, rx],
    [z0, z1, rz],
  ])
    if (Math.abs(b - a) > 1e-14)
      for (const side of [-r, r]) candidates.push((side - a) / (b - a));
  const valid = candidates.filter((t) => t >= 0 && t <= 1 && inside(t));
  const expected = valid.length ? Math.min(...valid) : null;
  const actual = api.sweepContact(x0, z0, x1, z1,rx,rz);
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
const report={modeSeedRuns:rows.length,activeSecondsPerRun:200,determinismModeSeedRuns:20,straightCrashModeSeedRuns:40,sweptContactCases:fuzz,narrowPass:{nearMisses:narrow.nearMisses,nitro:narrow.nitro},runs:rows};
const fs=require('node:fs'),path=require('node:path'),out=path.join(ROOT,'artifacts/evidence/v1.1');
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'manual-engine-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,runs:undefined},null,2));
