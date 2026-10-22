const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const path=require('node:path');
test('real OfflineAudioContext: engine, speed pitch, boost and cue signals; mute/pause silence',async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/root/.hermes/tools/chromium-1208/chrome-linux/chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.addScriptTag({path:path.resolve(__dirname,'../audio.js')});
  const results=await page.evaluate(async()=>{
   async function render(kind){
    const context=new OfflineAudioContext(1,24000,48000);
    const audio=Neon.Audio.create({createContext:()=>context});
    const s={phase:'running',speed:kind==='fast'?84:36,boosting:kind==='boost',lastNearMiss:kind==='cue'?{id:1}:null};
    audio.update({...s,lastNearMiss:null});await audio.setEnabled(true);audio.update(s);
    if(kind==='mute')await audio.setEnabled(false);
    if(kind==='pause')audio.update({...s,phase:'paused'});
    const buffer=await context.startRendering(),data=buffer.getChannelData(0);
    let power=0,crossings=0;for(let i=1;i<data.length;i++){power+=data[i]*data[i];if(data[i-1]<0&&data[i]>=0)crossings++;}
    return {rms:Math.sqrt(power/data.length),crossings,samples:Array.from(data.slice(0,12000))};
   }
   const out={};for(const kind of ['engine','fast','boost','cue','mute','pause'])out[kind]=await render(kind);return out;
  });
  for(const kind of ['engine','fast','boost','cue'])assert(results[kind].rms>.005,kind);
  assert(results.fast.crossings>results.engine.crossings);
  assert.notDeepEqual(results.boost.samples,results.engine.samples);assert.notDeepEqual(results.cue.samples,results.engine.samples);
  assert.equal(results.mute.rms,0);assert.equal(results.pause.rms,0);
 }finally{await browser.close();}
});
