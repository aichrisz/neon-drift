const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

for (const delivery of ['source', 'dist', 'offline']) {
  const url = pathToFileURL(path.resolve(__dirname, '../..',
    delivery === 'source' ? 'index.html' : delivery === 'dist'
      ? 'dist/index.html' : 'artifacts/Neon-Drift.html')).href;

  async function start(page) {
    // Environment seed only: native UI controls own all live game transitions.
    await page.addInitScript(() => {
      crypto.getRandomValues = array => { array.fill(7); return array; };
    });
    await page.clock.install();
    await page.goto(url);
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.getByRole('button', { name: 'Mulai mengemudi' }).click();
    await page.clock.runFor(64);
    await expect(page.locator('#phase')).toHaveText('MENGEMUDI');
  }

  for (const setting of ['decorations', 'sound']) {
    test(`${delivery}: native Space toggles ${setting} twice while driving without nitro`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await start(page);
      const checkbox = page.locator('#' + setting);
      const initial = await checkbox.isChecked();
      const reserve = Number(await page.locator('#nitro').getAttribute('value'));
      const distance = Number(await page.locator('#distance').textContent());
      await checkbox.focus();
      for (const checked of [!initial, initial]) {
        // Native checkbox activation happens on keyup. Hold through real game
        // frames to also prove settings keydown never starts a boost.
        await page.keyboard.down('Space');
        await page.clock.runFor(160);
        await expect(page.locator('[data-input="nitro"]')).toHaveAttribute('aria-pressed', 'false');
        await page.keyboard.up('Space');
        await expect(checkbox).toBeChecked({ checked });
        await page.clock.runFor(64);
        await expect(checkbox).toBeFocused();
        await expect(page.locator('#phase')).toHaveText('MENGEMUDI');
        expect(Number(await page.locator('#nitro').getAttribute('value'))).toBe(reserve);
      }
      expect(Number(await page.locator('#distance').textContent())).toBeGreaterThan(distance);
      expect(errors).toEqual([]);
    });
  }

  test(`${delivery}: keyup on a setting still clears gameplay keys held before focus changed`, async ({ page }) => {
    await start(page);
    await page.keyboard.down('Space');
    await page.clock.runFor(160);
    await expect(page.locator('[data-input="nitro"]')).toHaveAttribute('aria-pressed', 'true');
    expect(Number(await page.locator('#nitro').getAttribute('value'))).toBeLessThan(55);
    await page.locator('#sound').focus();
    await page.keyboard.up('Space');
    await expect(page.locator('[data-input="nitro"]')).toHaveAttribute('aria-pressed', 'false');
    const reserve = Number(await page.locator('#nitro').getAttribute('value'));
    await page.clock.runFor(160);
    expect(Number(await page.locator('#nitro').getAttribute('value'))).toBe(reserve);

    await page.locator('#pause').focus();
    await page.keyboard.down('ArrowRight');
    await page.clock.runFor(64);
    await expect(page.locator('[data-input="right"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#decorations').focus();
    await page.keyboard.up('ArrowRight');
    await expect(page.locator('[data-input="right"]')).toHaveAttribute('aria-pressed', 'false');
    await page.clock.runFor(64);
    await expect(page.locator('#phase')).toHaveText('MENGEMUDI');
  });
}
