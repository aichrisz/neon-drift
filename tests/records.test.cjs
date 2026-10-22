const {test}=require('node:test');const assert=require('node:assert/strict');
const {Records}=require('../records.js');
test('corrupt, prototype-like, oversize and bounded whitelisted profiles',()=>{
 for(const raw of ['',null,'null','[]','{"version":2}', '{"version":1,"__proto__":{"bestScore":9}}','x'.repeat(1025)])assert.deepEqual(Records.parse(raw),Records.empty());
 const p=Records.parse('{"version":1,"bestScore":12,"bestDistance":-1,"bestNearMisses":1.2,"runs":99999999,"extra":5}');
 assert.deepEqual(p,{version:1,bestScore:12,bestDistance:0,bestNearMisses:0,runs:0});
});
test('denied read and quota write have separate truthful session outcomes',()=>{
 const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
 const a=Records.open(denied);assert.equal(a.readable,false);
 const r=a.finish({score:123,distance:65.2,nearMisses:2});assert.equal(r.saved,false);assert.equal(r.profile.bestScore,123);
 r.profile.bestScore=0;assert.equal(a.profile().bestScore,123);
 const quota=Records.open({getItem(){return '{"version":1,"bestScore":8,"runs":2}'},setItem(){throw Error('quota')}});
 assert.equal(quota.readable,true);const q=quota.finish({score:10,distance:4,nearMisses:0});assert.equal(q.saved,false);assert.equal(q.profile.runs,3);
});
test('successful exact key write; finite safe integers only',()=>{
 let written;const r=Records.open({getItem(){return null},setItem(k,v){written=[k,v]}});
 assert.equal(r.finish({score:Infinity,distance:NaN,nearMisses:-4}).saved,true);
 assert.equal(written[0],'neon-drift.records.v1');assert.deepEqual(JSON.parse(written[1]),{version:1,bestScore:0,bestDistance:0,bestNearMisses:0,runs:1});
});
