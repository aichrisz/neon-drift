const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Records } = require("../records.js");
test('Normal legacy records preserved; Hard isolated and validated',()=>{
 const old=JSON.stringify({version:1,bestScore:123,bestDistance:65,bestNearMisses:1,runs:2});
 const data=new Map([[Records.KEY,old]]);const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.throws(()=>Records.open(storage,{mode:'bogus'}));
 const normal=Records.open(storage),hard=Records.open(storage,{mode:'hard'});
 assert.equal(normal.profile().bestScore,123);assert.equal(hard.profile().bestScore,0);
 assert(hard.finish({score:456,distance:100,nearMisses:3}).saved);
 assert.equal(data.get(Records.KEY),old);assert.equal(JSON.parse(data.get(Records.KEY+'.hard')).bestScore,456);
 assert.equal(Records.open(storage,{mode:'normal'}).profile().bestScore,123);
 for(const mode of ['normal','hard']){
  const denied=Records.open({getItem(){throw Error('denied')},setItem(){throw Error('quota')}},{mode});
  assert.equal(denied.readable,false);assert.equal(denied.finish({score:5}).saved,false);
 }
});
test("corrupt, prototype-like, oversize and bounded whitelisted profiles", () => {
  for (const raw of [
    "",
    null,
    "null",
    "[]",
    '{"version":2}',
    '{"version":1,"__proto__":{"bestScore":9}}',
    "x".repeat(1025),
  ])
    assert.deepEqual(Records.parse(raw), Records.empty());
  const p = Records.parse(
    '{"version":1,"bestScore":12,"bestDistance":-1,"bestNearMisses":1.2,"runs":99999999,"extra":5}',
  );
  assert.deepEqual(p, {
    version: 1,
    bestScore: 12,
    bestDistance: 0,
    bestNearMisses: 0,
    runs: 0,
  });
});
test("denied read and quota write have separate truthful session outcomes", () => {
  const denied = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
  };
  const a = Records.open(denied);
  assert.equal(a.readable, false);
  const r = a.finish({ score: 123, distance: 65.2, nearMisses: 2 });
  assert.equal(r.saved, false);
  assert.equal(r.profile.bestScore, 123);
  r.profile.bestScore = 0;
  assert.equal(a.profile().bestScore, 123);
  const quota = Records.open({
    getItem() {
      return '{"version":1,"bestScore":8,"runs":2}';
    },
    setItem() {
      throw Error("quota");
    },
  });
  assert.equal(quota.readable, true);
  const q = quota.finish({ score: 10, distance: 4, nearMisses: 0 });
  assert.equal(q.saved, false);
  assert.equal(q.profile.runs, 3);
});
test("successful exact key write; finite safe integers only", () => {
  let written;
  const r = Records.open({
    getItem() {
      return null;
    },
    setItem(k, v) {
      written = [k, v];
    },
  });
  assert.equal(
    r.finish({ score: Infinity, distance: NaN, nearMisses: -4 }).saved,
    true,
  );
  assert.equal(written[0], "neon-drift.records.v1");
  assert.deepEqual(JSON.parse(written[1]), {
    version: 1,
    bestScore: 0,
    bestDistance: 0,
    bestNearMisses: 0,
    runs: 1,
  });
});
