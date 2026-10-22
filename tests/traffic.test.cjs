const {test}=require('node:test'); const assert=require('node:assert/strict');
const {Engine,CONFIG,sweepContact}=require('../engine.js');
function run(e,n,dt=.1){for(let i=0;i<n;i++)e.step(dt);return e.snapshot();}
test('swept two-axis exact edge contact and lateral tunneling',()=>{
 assert.equal(sweepContact(0,10,0,-10), (10-CONFIG.contactLength)/20);
 assert.equal(sweepContact(-1,0,1,0), (1-CONFIG.contactWidth)/2);
 assert.equal(sweepContact(1,10,1,-10),null);
 assert.equal(sweepContact(CONFIG.contactWidth,CONFIG.contactLength,1,10),0);
});
test('actual seeded crash stops exactly at contact, results freeze and replay clears',()=>{
 const e=Engine.create({seed:7}); e.start(); let s=e.snapshot();
 const lane=s.traffic[0].x; e.setInput({left:lane<0,right:lane>0}); run(e,10);
 e.setInput({}); s=run(e,400);
 assert.equal(s.phase,'results'); assert(s.crash); assert.equal(s.nearMisses,0);
 const car=s.traffic.find(c=>c.id===s.crash.id); assert(Math.abs(car.z-CONFIG.contactLength)<1e-8);
 assert.equal(s.score,Math.floor(s.distance*CONFIG.distancePoints));
 assert.deepEqual(run(e,100),s); e.start(); assert.equal(e.snapshot().crash,null); assert.equal(e.snapshot().score,0);
});
test('nitro consumption, brake priority, release, empty pool and cap',()=>{
 const e=Engine.create({seed:3});e.start();e.setInput({nitro:true});let s=run(e,10);
 assert(s.nitro<CONFIG.initialNitro);assert(s.speed>CONFIG.cruiseSpeed);
 e.setInput({nitro:true,brake:true});const pool=s.nitro;s=run(e,10);assert.equal(s.nitro,pool);assert(s.speed<=CONFIG.cruiseSpeed);
 e.setInput({nitro:true});s=run(e,25);assert.equal(s.nitro,0);assert.equal(s.boosting,false);
 e.setInput({});s=run(e,10);assert(s.speed<CONFIG.maxSpeed);
});
test('real narrow pass awards once, distant pass awards nothing',()=>{
 for(const near of [true,false]){
 const e=Engine.create({seed:7});e.start();
 const lane=e.snapshot().traffic[0].x;
 // seed 7 first occupied lane is 0; x=.4 is narrow clearance, x=-1 is the open lane.
 assert.equal(lane,0);e.setInput({right:near,left:!near});run(e,near?30:75,1/120);e.setInput({});
 let s; for(let i=0;i<180;i++){s=run(e,1);if(s.traffic.some(c=>c.passed))break;}
 assert.equal(s.phase,'running');assert.equal(s.nearMisses,near?1:0);
 assert.equal(s.score,Math.floor(s.distance*CONFIG.distancePoints)+s.nearMisses*CONFIG.nearMissPoints);
 assert.equal(s.nitro,CONFIG.initialNitro+(near?CONFIG.nitroRecharge:0));
 const count=s.nearMisses;run(e,5);assert.equal(e.snapshot().nearMisses,count);
 }
});
test('large delta clamp and active time partitions agree',()=>{
 const a=Engine.create({seed:9}),b=Engine.create({seed:9});a.start();b.start();a.setInput({nitro:true});b.setInput({nitro:true});
 a.step(1e6);b.step(CONFIG.maxDelta);assert.deepEqual(a.snapshot(),b.snapshot());
 for(let i=0;i<60;i++)a.step(1/60);for(let i=0;i<120;i++)b.step(1/120);
 assert(Math.abs(a.snapshot().distance-b.snapshot().distance)<1e-7);
});
