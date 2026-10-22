// Independent parent acceptance: rectangular-face oracle, public input only.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = require('node:path').resolve(__dirname, '../..');
const { Engine } = require(root + '/engine.js');
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
function faceContact(x0,z0,x1,z1,rx,rz) {
  const faces = [0,1];
  for (const [a,b,r] of [[x0,x1,rx],[z0,z1,rz]])
    if (Math.abs(b-a)>1e-14) for (const edge of [-r,r]) faces.push((edge-a)/(b-a));
  const valid = faces.filter(t => t>=0 && t<=1 && Math.abs(x0+(x1-x0)*t)<=rx+1e-10 && Math.abs(z0+(z1-z0)*t)<=rz+1e-10);
  return valid.length ? Math.min(...valid) : null;
}
let samples=0, crashes=0, boosts=0, brakes=0;
const rows=[];
for (const mode of ['normal','hard']) for(let seed=1;seed<=30;seed++) {
  const e=Engine.create({seed,mode}); e.start();
  for (let i=0;i<240*50;i++) {
    const s=e.snapshot(); if(s.phase!=='running')break;
    const input={left: i%1300>1190,right:i%1700>1530,nitro:i%1900<1000,brake:i%1100<95};
    e.setInput(input);
    let dt=1/240;
    const boost=input.nitro&&!input.brake&&s.nitro>1e-10;
    if(boost) {dt=Math.min(dt,s.nitro/26);boosts++;} if(input.brake)brakes++;
    const target=input.brake?22:boost?84:Math.min(mode==='hard'?66:58,(mode==='hard'?52:46)+s.elapsed*(mode==='hard'?.2:.12));
    const rate=target<s.speed?48:24;
    const v1=s.speed+clamp(target-s.speed,-rate*dt,rate*dt);
    const travel=(s.speed+v1)/2*dt;
    const x1=clamp(s.playerX+(Number(input.right)-Number(input.left))*1.6*dt,-1,1);
    const waves=[...new Set(s.traffic.map(c=>c.wave))].map(w=>s.traffic.filter(c=>c.wave===w)).sort((a,b)=>b[0].z-a[0].z);
    const velocities=new Map();let leader;
    for(const group of waves){
      const c=group[0];const desired={compact:22,sedan:20,van:16}[c.type];
      const v=Math.min(desired,leader?leader.v+Math.max(0,leader.z-c.z-(mode==='hard'?108:125))/dt:Infinity);
      for(const car of group)velocities.set(car.id,v);leader={z:c.z,v};
    }
    let hit=null,fraction=1;
    for(const c of s.traffic){
      const t=faceContact(s.playerX-c.x,c.z,x1-c.x,c.z-travel+velocities.get(c.id)*dt,(.32+c.width)/2,(4.4+c.length)/2);
      if(t!==null&&(hit===null||t<fraction)){hit=c;fraction=t;}
    }
    e.step(dt);const n=e.snapshot();samples++;
    assert(Math.abs(n.elapsed-s.elapsed-dt*fraction)<1e-9);
    assert(Math.abs(n.distance-s.distance-travel*fraction)<1e-8);
    assert(Math.abs(n.playerX-s.playerX-(x1-s.playerX)*fraction)<1e-9);
    assert(Math.abs(n.speed-s.speed-(v1-s.speed)*fraction)<1e-8);
    for(const c of s.traffic){const next=n.traffic.find(t=>t.id===c.id);if(next)assert(Math.abs(next.z-c.z+(travel-velocities.get(c.id)*dt)*fraction)<1e-8);}
    if(hit){
      crashes++; assert.equal(n.phase,'results');assert.equal(n.crash.id,hit.id);
      assert.equal(n.nearMisses,s.nearMisses);assert.equal(n.nearMissBonus,s.nearMissBonus);
      assert(Math.abs(n.nitro-Math.max(0,s.nitro-(boost?26*dt*fraction:0)))<1e-8);
      e.step(.25);assert.deepEqual(e.snapshot(),n);
      rows.push({mode,seed,hit:hit.type,elapsed:n.elapsed,boost,brake:input.brake});break;
    }else assert.equal(n.phase,'running');
  }
}
assert.equal(crashes,60);assert(boosts>0&&brakes>0);
const report={samples,crashes,boostSegments:boosts,brakeSegments:brakes,modes:['normal','hard'],rows};
fs.mkdirSync(root+'/artifacts/acceptance',{recursive:true});
fs.writeFileSync(root+'/artifacts/acceptance/parent-v11-resources.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,rows:undefined},null,2));
