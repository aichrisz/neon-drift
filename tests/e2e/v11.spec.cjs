const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.resolve(__dirname,'../../index.html')).href;
test('renderer respects actual widths, type silhouettes and reduced decoration boost suppression',async({page})=>{
 await page.goto(source);
 const images=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.style='width:800px;height:450px';document.body.append(canvas);
  const renderer=Neon.Renderer.create(canvas),e=Neon.Engine.create({seed:7});e.start();
  const base={...e.snapshot(),traffic:[],boosting:false};
  const capture=s=>{renderer.draw(s,false);return canvas.toDataURL();};
  const car={id:1,wave:1,x:0,z:30,color:0,type:'sedan',width:.34,length:4.4,speed:20};
  const out={sedan:capture({...base,traffic:[car]}),narrow:capture({...base,traffic:[{...car,width:.28}]}),van:capture({...base,traffic:[{...car,type:'van'}]}),quiet:capture(base),boost:capture({...base,boosting:true})};
  canvas.remove();return out;
 });
 expect(images.narrow!==images.sedan,'actual width changes rendered footprint').toBe(true);expect(images.van!==images.sedan,'type silhouette').toBe(true);expect(images.quiet===images.boost,'reduced boost decorations').toBe(true);
});
for(const [width,height] of [[320,568],[390,844],[768,1024],[1366,768],[1440,900]]){
 test(`layout and all-phase accessibility ${width} DPR2`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2});const page=await context.newPage();
  await page.addInitScript(()=>{crypto.getRandomValues=a=>{a.fill(7);return a;};});
  await page.clock.install();await page.goto(source);await page.clock.pauseAt(new Date(Date.now()+100));
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  await page.locator('#mode').selectOption('hard');
  for(const phase of ['ready','running','paused','results']){
   if(phase==='running')await page.locator('#primary').click();
   if(phase==='paused')await page.keyboard.press('p');
   if(phase==='results'){await page.locator('#primary').click();for(let i=0;i<140;i++)await page.clock.fastForward(100);await expect(page.locator('#phase')).toHaveText('SELESAI');}
   await page.clock.resume();
   expect(await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))).toEqual([]);
   await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
   const boxes=await page.evaluate(phase=>{
    const selectors=['.dashboard','canvas','.controls','#sound','#decorations',...(phase==='running'?['#pause','.feedback']:['#primary','#mode'])];
    return {overflow:document.documentElement.scrollWidth>innerWidth,boxes:selectors.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {s,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}),dpr:document.querySelector('canvas').width/document.querySelector('canvas').getBoundingClientRect().width};
   },phase);
   expect(boxes.overflow).toBe(false);expect(boxes.dpr).toBeLessThanOrEqual(2.01);
   for(const b of boxes.boxes){expect(b.x,b.s).toBeGreaterThanOrEqual(0);expect(b.y,b.s).toBeGreaterThanOrEqual(0);expect(b.right,b.s).toBeLessThanOrEqual(width);expect(b.bottom,b.s).toBeLessThanOrEqual(height);}
   const overlaps=await page.evaluate(phase=>{
    // The menu intentionally overlays the world, never the driving controls.
    // Test sibling HUD/actions, not their containing boxes.
    const selectors=phase==='running'?['.dashboard','#mode-label','#phase','#pause','.feedback',...Array.from(document.querySelectorAll('[data-input]'),e=>`[data-input="${e.dataset.input}"]`)]:['.dashboard','#panel','.controls'];
    const boxes=selectors.map(s=>({s,r:document.querySelector(s).getBoundingClientRect()})),bad=[];
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
     const a=boxes[i],b=boxes[j];if(Math.min(a.r.right,b.r.right)>Math.max(a.r.left,b.r.left)+.5&&Math.min(a.r.bottom,b.r.bottom)>Math.max(a.r.top,b.r.top)+.5)bad.push([a.s,b.s]);
    }return bad;
   },phase);
   expect(overlaps).toEqual([]);
   await page.screenshot({path:`artifacts/evidence/v1.1/layout-${width}-${phase}.png`});
  }
  await context.close();
 });
}
async function instrument(page){
 await page.addInitScript(()=>{
  const Real=window.AudioContext;window.audioProbe={contexts:[],gains:[],oscillators:0};
  window.AudioContext=class extends Real{constructor(...args){super(...args);audioProbe.contexts.push(this);}
   createGain(){const g=super.createGain();audioProbe.gains.push(g);return g;}
   createOscillator(){audioProbe.oscillators++;return super.createOscillator();}
  };
 });
}
test('native mode, tutorial, combo HUD and lazy opt-in real audio lifecycle',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);await page.goto(source);
 const mode=page.getByRole('combobox',{name:/Mode/});await expect(mode).toBeVisible();await mode.selectOption('hard');
 await expect(page.locator('#panel-description')).toContainText('sepenuhnya');
 await expect(page.locator('#combo')).toContainText('COMBO');
 await expect(page.getByRole('checkbox',{name:/Suara/})).not.toBeChecked();
 expect(await page.evaluate(()=>audioProbe.contexts.length)).toBe(0);
 await page.locator('#sound').check();await expect(page.locator('#sound-status')).toHaveText('Suara aktif');
 await page.locator('#primary').click();await expect(page.locator('#mode-label')).toHaveText('Hard');await expect(page.locator('#mode')).toBeDisabled();
 await expect(page.locator('#pause')).toBeFocused();
 await expect.poll(()=>page.evaluate(()=>audioProbe.gains[0].gain.value)).toBeGreaterThan(0);
 await page.keyboard.press('p');expect(await page.evaluate(()=>audioProbe.gains[0].gain.value)).toBe(0);
 await page.locator('#primary').click();await expect.poll(()=>page.evaluate(()=>audioProbe.gains[0].gain.value)).toBeGreaterThan(0);
 await page.locator('#sound').uncheck();expect(await page.evaluate(()=>audioProbe.gains[0].gain.value)).toBe(0);
 await page.locator('#sound').check();expect(await page.evaluate(()=>audioProbe.contexts.length)).toBe(1);
 expect(await page.evaluate(()=>audioProbe.oscillators)).toBe(3);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));expect(await page.evaluate(()=>audioProbe.gains[0].gain.value)).toBe(0);
 expect(errors).toEqual([]);
});
test('missing/rejected audio stays playable; pending resume cannot revive paused or muted sound',async({page,browser})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});await page.goto(source);
 await page.locator('#sound').check();await expect(page.locator('#sound-status')).toContainText('tidak tersedia');
 await page.locator('#primary').click();await expect(page.locator('#phase')).toHaveText('MENGEMUDI');
 // Fresh page restores native API; only resume scheduling is controlled, graph is real.
 const p=await browser.newPage();await instrument(p);
 await p.addInitScript(()=>{const real=AudioContext.prototype.resume;AudioContext.prototype.resume=function(){return Promise.reject(Error('blocked'));};});
 await p.goto(source);await p.locator('#sound').check();await expect(p.locator('#sound-status')).toContainText('tidak tersedia');await p.close();
 expect(errors).toEqual([]);
});
test('real context delayed resume is invalidated by pause and mute without stale cues',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await instrument(page);
 await page.addInitScript(()=>{AudioContext.prototype.resume=function(){return new Promise(resolve=>window.finishResume=resolve);};});
 await page.goto(source);await page.locator('#primary').click();await page.locator('#sound').check();await page.keyboard.press('p');
 await page.evaluate(()=>finishResume());await page.waitForTimeout(50);expect(await page.evaluate(()=>audioProbe.gains[0].gain.value)).toBe(0);
 await page.locator('#sound').uncheck();await page.locator('#sound').check();await page.locator('#sound').uncheck();await page.evaluate(()=>finishResume());await page.waitForTimeout(50);
 expect(await page.evaluate(()=>audioProbe.gains[0].gain.value)).toBe(0);expect(errors).toEqual([]);await context.close();
});
