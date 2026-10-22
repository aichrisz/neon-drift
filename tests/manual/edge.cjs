/* Additional parent browser matrix, deterministic environmental RNG not a game hook. */
const {
  assert,
  fs,
  path,
  ROOT,
  chromium,
  OUT,
  target,
  geometry,
} = require("./helpers.cjs");
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      "/root/.hermes/tools/chromium-1208/chrome-linux/chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const report = [];
  // Long edge runs use 100ms observed frames (controller cap), not thousands of
  // redundant 60Hz Canvas paints. Physics still integrates its real 120Hz steps.
  async function advance(p, ms) {
    for (let left = ms; left > 0; left -= 100)
      await p.clock.fastForward(Math.min(100, left));
  }
  const saveProgress = () =>
    fs.writeFileSync(
      path.join(OUT, "edge-report.json"),
      JSON.stringify(report, null, 2),
    );
  async function setup(options = {}, storageCase) {
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      offline: true,
      ...options,
    });
    await c.addInitScript(
      ({ storageCase }) => {
        // Inject only the environment's uint32 seed, before application initialization.
        crypto.getRandomValues = (array) => {
          for (let i = 0; i < array.length; i++) array[i] = 7;
          return array;
        };
        if (storageCase === "denied") {
          Storage.prototype.getItem = () => {
            throw new Error("synthetic read denied");
          };
          Storage.prototype.setItem = () => {
            throw new Error("synthetic write denied");
          };
        }
        if (storageCase === "quota")
          Storage.prototype.setItem = () => {
            throw new Error("synthetic quota");
          };
        if (["corrupt", "oversized", "adversarial"].includes(storageCase))
          localStorage.setItem(
            "neon-drift.records.v1",
            storageCase === "corrupt"
              ? "{"
              : storageCase === "oversized"
                ? "x".repeat(5000)
                : '{"version":1,"bestScore":"<img src=x onerror=alert(1)>","runs":-4,"__proto__":{"bestScore":999}}',
          );
      },
      { storageCase },
    );
    const p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.install();
    await p.goto(target);
    await p.clock.pauseAt(new Date(Date.now() + 1000));
    return { c, p, errors };
  }
  try {
    for (const [w, h] of [
      [320, 844],
      [390, 844],
      [768, 1024],
      [1366, 768],
      [1440, 900],
    ]) {
      const { c, p, errors } = await setup({
        viewport: { width: w, height: h },
      });
      await p.getByRole("button", { name: "Mulai mengemudi" }).click();
      await p.clock.runFor(64);
      await p.locator(".controls").scrollIntoViewIfNeeded();
      const box = await geometry(p, [
        "#road",
        ".controls",
        '[data-input="left"]',
        '[data-input="brake"]',
        '[data-input="nitro"]',
      ]);
      assert.ok(
        box.boxes
          .filter((b) => b.selector.startsWith("[data-input"))
          .every((b) => b.w >= 44 && b.h >= 44),
      );
      await p.screenshot({
        path: path.join(OUT, `viewport-${w}.png`),
        fullPage: true,
      });
      await p.setViewportSize({ width: 390, height: 844 });
      await p.clock.runFor(64);
      assert.equal(await p.locator("#phase").textContent(), "MENGEMUDI");
      await advance(p, 14000);
      assert.equal(await p.locator("#phase").textContent(), "SELESAI");
      const panel = await p.locator("#panel").boundingBox();
      assert.ok(
        panel.x >= 0 &&
          panel.y >= 0 &&
          panel.x + panel.width <= 390 &&
          panel.y + panel.height <= 844,
      );
      assert.deepEqual(errors, []);
      report.push({ case: "viewport-" + w, passed: true, layout: box });
      saveProgress();
      await c.close();
    }
    for (const kind of [
      "corrupt",
      "oversized",
      "adversarial",
      "denied",
      "quota",
    ]) {
      const { c, p, errors } = await setup({}, kind);
      await p.getByRole("button", { name: "Mulai mengemudi" }).click();
      await p.clock.runFor(64);
      await advance(p, 14000);
      assert.equal(await p.locator("#phase").textContent(), "SELESAI");
      const save = await p.locator("#save-status").textContent();
      if (["denied", "quota"].includes(kind)) {
        assert.match(save, /sesi/i);
        assert.doesNotMatch(save, /berhasil disimpan/);
      }
      await p.getByRole("button", { name: "Coba lagi" }).click();
      await p.clock.runFor(32);
      assert.equal(await p.locator("#phase").textContent(), "MENGEMUDI");
      assert.deepEqual(errors, []);
      report.push({ case: "storage-" + kind, passed: true, save });
      saveProgress();
      await c.close();
    }
    {
      const { c, p, errors } = await setup({ reducedMotion: "reduce" });
      assert.equal(await p.locator("#decorations").isChecked(), false);
      await p.getByRole("button", { name: "Mulai mengemudi" }).click();
      await p.clock.runFor(64);
      await advance(p, 1000);
      assert.ok(Number(await p.locator("#distance").textContent()) > 30);
      assert.deepEqual(errors, []);
      report.push({ case: "reduced-motion-essential-play", passed: true });
      saveProgress();
      await c.close();
    }
    {
      const c = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
        offline: true,
      });
      const p = await c.newPage();
      await p.goto(target);
      assert.ok(await p.locator(".no-script").isVisible());
      assert.ok(await p.locator("#primary").isDisabled());
      report.push({ case: "no-javascript", passed: true });
      saveProgress();
      await c.close();
    }
    {
      const { c, p, errors } = await setup();
      await p.getByRole("button", { name: "Mulai mengemudi" }).click();
      await p.clock.runFor(64);
      await p.keyboard.down("ArrowRight");
      await p.clock.runFor(250);
      await p.keyboard.up("ArrowRight");
      await p.keyboard.down("Space");
      await p.clock.runFor(400);
      await p.keyboard.up("Space");
      const reserve = Number(await p.locator("#nitro").getAttribute("value"));
      for (
        let i = 0;
        i < 25 && Number(await p.locator("#near").textContent()) === 0;
        i++
      )
        await advance(p, 1000);
      assert.equal(Number(await p.locator("#near").textContent()), 1);
      assert.ok(
        Math.abs(
          Number(await p.locator("#nitro").getAttribute("value")) -
            (reserve + 16),
        ) < 1e-6,
      );
      assert.equal(await p.locator("#phase").textContent(), "MENGEMUDI");
      assert.deepEqual(errors, []);
      report.push({
        case: "native-near-miss-recharge",
        passed: true,
        nearMisses: 1,
        recharge: 16,
      });
      saveProgress();
      await c.close();
    }
    fs.writeFileSync(
      path.join(OUT, "edge-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify(
        { cases: report.length, allPassed: report.every((r) => r.passed) },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
