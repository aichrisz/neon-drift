const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.resolve(__dirname,'../../index.html')).href;
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
