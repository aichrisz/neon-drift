const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
for(const delivery of ['source','dist','offline'])for(const mode of ['normal','hard']){
 test(`${delivery} ${mode} native near-pass feedback, boost, crash and replay`,async({page,context})=>{
  const requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await context.setOffline(true);
  await page.addInitScript(()=>{crypto.getRandomValues=a=>{a.fill(7);return a;};window.AudioContext=undefined;window.webkitAudioContext=undefined;});
  await page.clock.install();
  const url=pathToFileURL(path.resolve(__dirname,'../..',delivery==='source'?'index.html':delivery==='dist'?'dist/index.html':'artifacts/Neon-Drift.html')).href;
  await page.goto(url);await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.locator('#mode').selectOption(mode);await page.locator('#sound').check();await expect(page.locator('#sound-status')).toHaveText('Suara tidak tersedia');
  await page.locator('#primary').click();await page.clock.runFor(64);
  await page.keyboard.down('ArrowRight');await page.clock.runFor(250);await page.keyboard.up('ArrowRight');
  await page.keyboard.down('Space');await page.clock.runFor(400);
  await page.screenshot({path:`artifacts/evidence/v1.1/${delivery}-${mode}-boost.png`});
  await page.keyboard.up('Space');const reserve=Number(await page.locator('#nitro').getAttribute('value'));
  for(let i=0;i<160&&Number(await page.locator('#near').textContent())===0;i++)await page.clock.fastForward(100);
  await expect(page.locator('#phase')).toHaveText('MENGEMUDI');await expect(page.locator('#near')).toHaveText('1');
  await expect(page.locator('#near-event')).toHaveText('NEAR MISS · +16 NITRO');await expect(page.locator('#near-event')).toBeVisible();
  await expect(page.locator('#combo')).toHaveText('COMBO 1 · ×1');
  expect(Number(await page.locator('#nitro').getAttribute('value'))).toBeCloseTo(reserve+16,8);
  await page.screenshot({path:`artifacts/evidence/v1.1/${delivery}-${mode}-near-miss.png`});
  await page.keyboard.press('p');const remaining=await page.locator('#combo-time').getAttribute('value');await page.clock.runFor(9000);
  expect(await page.locator('#combo-time').getAttribute('value')).toBe(remaining);await expect(page.locator('#near-event')).toBeVisible();
  await page.locator('#primary').click();await page.clock.runFor(32);
  await page.keyboard.down('ArrowLeft');await page.clock.runFor(250);await page.keyboard.up('ArrowLeft');
  for(let i=0;i<1000&&(await page.locator('#phase').textContent())==='MENGEMUDI';i++)await page.clock.fastForward(100);
  await expect(page.locator('#phase')).toHaveText('SELESAI');await expect(page.locator('#panel-kicker')).toContainText(mode==='hard'?'Hard':'Normal');
  await page.screenshot({path:`artifacts/evidence/v1.1/${delivery}-${mode}-results.png`});
  await page.locator('#primary').click();await expect(page.locator('#combo')).toHaveText('COMBO 0 · ×1');await expect(page.locator('#near-event')).toBeHidden();
  await expect(page.locator('#mode-label')).toHaveText(mode==='hard'?'Hard':'Normal');expect(errors).toEqual([]);
  if(delivery==='offline')expect(requests).toEqual([url]);
 });
}
