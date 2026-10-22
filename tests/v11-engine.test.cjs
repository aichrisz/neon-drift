const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Engine,CONFIG,MODE_CONFIG,VEHICLES,sweepContact}=require('../engine.js');
test('mode is validated and visible',()=>{
 assert.throws(()=>Engine.create({mode:'bogus'}));
 const e=Engine.create({seed:7,mode:'hard'});e.start();
 assert.equal(e.snapshot().mode,'hard');assert.equal(e.snapshot().speed,42);
 assert(Object.isFrozen(MODE_CONFIG));assert(Object.isFrozen(MODE_CONFIG.normal));
 assert.deepEqual(MODE_CONFIG.normal,{startSpeed:36,cruiseSpeed:46,maxCruiseSpeed:58,difficultyRate:.12,spacing:140,minGap:125,rampSeconds:120});
 assert.deepEqual(MODE_CONFIG.hard,{startSpeed:42,cruiseSpeed:52,maxCruiseSpeed:66,difficultyRate:.20,spacing:125,minGap:108,rampSeconds:90});
});
test('typed geometry and optional swept radii are exact',()=>{
 assert(Object.isFrozen(VEHICLES));
 assert.deepEqual(VEHICLES,{compact:{width:.28,length:3.8,speed:22},sedan:{width:.34,length:4.4,speed:20},van:{width:.46,length:6,speed:16}});
 assert.equal(sweepContact(.38,10,.38,-10,.39,5.2),.24);
 assert.equal(sweepContact(.38,10,.38,-10,.30,4.1),null);
 assert.equal(sweepContact(0,10,0,-10),(10-4.4)/20);
 assert(108>(84-16)*(2/1.6)+2*5.2);
});
// A driver chooses an actually clear integer center for the nearest unpassed
// contact zone. Steering happens through public input only, never state mutation.
function drive(e, seconds, observe=()=>{}, vary=true){
 for(let i=0;i<seconds*120;i++){
  const s=e.snapshot();assert.equal(s.phase,'running',`crash at ${s.elapsed}`);
  const next=s.traffic.filter(c=>c.z>=-(CONFIG.playerLength+c.length)/2-.1).sort((a,b)=>a.z-b.z)[0];
  const cars=next?s.traffic.filter(c=>c.wave===next.wave):[];
  const clear=[-1,0,1].filter(x=>cars.every(c=>Math.abs(x-c.x)>(CONFIG.playerWidth+c.width)/2+.03));
  const target=clear.sort((a,b)=>Math.abs(a-s.playerX)-Math.abs(b-s.playerX))[0]??s.playerX;
  e.setInput({left:s.playerX>target+.007,right:s.playerX<target-.007,brake:vary&&i%2400<240,nitro:vary&&i%1800<300});
  e.step(1/120);observe(e.snapshot(),s);
 }
}
test('sustained mixed-speed traversal: integrated gap, shared wave speed, population and variety in both modes',()=>{
 for(const mode of ['normal','hard']) for(const seed of [7,42,99]){
  const e=Engine.create({seed,mode});e.start();const types=new Set(),phases=new Set();let constrained=false;
  drive(e,180,(s,prev)=>{
   assert(s.traffic.length<=10);
   const waves=[...new Set(s.traffic.map(c=>c.wave))].map(w=>s.traffic.filter(c=>c.wave===w)).sort((a,b)=>a[0].z-b[0].z);
   for(let j=0;j<waves.length;j++){
    const group=waves[j],c=group[0];types.add(c.type);phases.add(Math.round((c.x-Math.round(c.x))*100));
    assert(group.length<=2);assert(group.every(a=>a.type===c.type&&a.speed===c.speed&&a.z===c.z));
    assert([-1,0,1].some(x=>group.every(a=>Math.abs(x-a.x)>(.32+a.width)/2)));
    assert(c.speed>=16-1e-7&&c.speed<=VEHICLES[c.type].speed+1e-7);
    if(c.speed<VEHICLES[c.type].speed-.001)constrained=true;
    if(j)assert(c.z-waves[j-1][0].z>=MODE_CONFIG[mode].minGap-1e-7);
    for(const a of group){
     assert.equal(a.width,VEHICLES[a.type].width);assert.equal(a.length,VEHICLES[a.type].length);
     const old=prev.traffic.find(b=>b.id===a.id);
     if(old)assert(Math.abs(a.z-old.z+(s.distance-prev.distance)-a.speed*(s.elapsed-prev.elapsed))<1e-7,'no positional correction/teleport');
    }
   }
  });
  assert.equal(types.size,3);assert.equal(phases.size,3);assert(constrained,'mixed waves must exercise speed limiting');
 }
});
module.exports={drive};

function nearDrive(e, until, observe=()=>{}) {
 for(let i=0;i<until*120;i++){
  const s=e.snapshot();assert.equal(s.phase,'running');
  const next=s.traffic.filter(c=>c.z>=-(4.4+c.length)/2-.1).sort((a,b)=>a.z-b.z)[0];
  const group=s.traffic.filter(c=>c.wave===next.wave);
  const targets=group.flatMap(c=>[-1,1].map(sign=>c.x+sign*((.32+c.width)/2+.07)))
   .filter(x=>Math.abs(x)<=1&&group.every(c=>Math.abs(x-c.x)>(.32+c.width)/2+.04));
  const target=targets.sort((a,b)=>Math.abs(a-s.playerX)-Math.abs(b-s.playerX))[0];
  e.setInput({left:s.playerX>target+.007,right:s.playerX<target-.007});e.step(1/120);observe(e.snapshot(),s);
 }
}
test('actual near passes: incremental combo, capped nitro, immutable events, expiry/pause/replay',()=>{
 for(const mode of ['normal','hard']){
  const e=Engine.create({seed:7,mode});e.start();let events=[],last=0,total=0;
  nearDrive(e,60,(s,prev)=>{
   assert.equal(s.score,Math.floor(s.distance*2)+total+(s.lastNearMiss?.id>last?s.lastNearMiss.bonus:0));
   if(s.lastNearMiss?.id>last){
    const ev=s.lastNearMiss;assert.equal(ev.id,++last);assert(Object.isFrozen(ev));
    assert.notEqual(ev,e.snapshot().lastNearMiss);
    assert.equal(ev.combo,events.length+1);assert.equal(ev.multiplier,Math.min(4,ev.combo));
    assert.equal(ev.bonus,150*Math.min(4,ev.combo));total+=ev.bonus;
    assert.equal(ev.nitroAdded,Math.min(16,100-prev.nitro));
    assert.equal(s.nitro,Math.min(100,prev.nitro+16));
    assert(s.traffic.some(c=>c.passed&&c.z<-(4.4+c.length)/2));events.push(ev);
   }
   assert.equal(s.nearMissBonus,total);assert.equal(s.nearMisses,last);
  });
  assert(events.length>=4);assert.equal(events[0].bonus,150);assert.equal(events[1].bonus,300);
  assert(events.some(ev=>ev.nitroAdded===0));assert.equal(e.snapshot().bestCombo,last);
  e.pause();const paused=e.snapshot();e.step(100);assert.deepEqual(e.snapshot(),paused);e.resume();
  e.setInput({brake:true});for(let i=0;i<1100;i++)e.step(1/120);
  assert.equal(e.snapshot().phase,'running');assert.equal(e.snapshot().combo,0);assert.equal(e.snapshot().multiplier,1);assert.equal(e.snapshot().comboRemaining,0);
  e.start();const reset=e.snapshot();assert.equal(reset.mode,mode);assert.equal(reset.combo,0);assert.equal(reset.bestCombo,0);assert.equal(reset.lastNearMiss,null);assert.equal(reset.nearMissBonus,0);
 }
});
