/* Parent native play-through, real UI and renderer; no game-state hook. */
const {
  assert,
  fs,
  path,
  ROOT,
  chromium,
  OUT,
  mode,
  target,
  numeric,
  auditLoop,
  geometry,
} = require("./helpers.cjs");
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const touch = process.env.NEON_TOUCH === "1";
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      "/root/.hermes/tools/chromium-1208/chrome-linux/chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: touch
      ? { width: 390, height: 844 }
      : { width: 1366, height: 768 },
    deviceScaleFactor: 2,
    hasTouch: touch,
    isMobile: touch,
    offline: true,
  });
  const page = await context.newPage();
  const requests = [],
    errors = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) =>
    errors.push(r.url() + ": " + r.failure()?.errorText),
  );
  try {
    await page.clock.install();
    await page.goto(target);
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await auditLoop(page);
    const start = page.getByRole("button", {
      name: "Mulai mengemudi",
      exact: false,
    });
    assert.ok(await start.isEnabled());
    const style = await page.evaluate(() => ({
      body: getComputedStyle(document.documentElement).backgroundColor,
      canvasCount: document.querySelectorAll("canvas").length,
    }));
    assert.notEqual(style.body, "rgba(0, 0, 0, 0)");
    assert.equal(style.canvasCount, 1);
    await page.screenshot({
      path: path.join(OUT, `${mode}-${touch ? "touch" : "desktop"}-ready.png`),
      fullPage: true,
    });
    assert.equal(await page.evaluate(() => window.__parentRafAudit.pending), 0);
    await start.click();
    await page.clock.runFor(64);
    assert.equal(await page.locator("#phase").textContent(), "MENGEMUDI");
    await page.locator(".controls").scrollIntoViewIfNeeded();
    const layout = await geometry(page, [
      "#road",
      ".controls",
      '[data-input="left"]',
      '[data-input="nitro"]',
    ]);
    if (touch) {
      const right = await page.locator('[data-input="right"]').boundingBox(),
        nitro = await page.locator('[data-input="nitro"]').boundingBox();
      const cdp = await context.newCDPSession(page);
      const reserve = Number(
        await page.locator("#nitro").getAttribute("value"),
      );
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          {
            x: right.x + right.width / 2,
            y: right.y + right.height / 2,
            id: 1,
          },
          {
            x: nitro.x + nitro.width / 2,
            y: nitro.y + nitro.height / 2,
            id: 2,
          },
        ],
      });
      await page.clock.runFor(200);
      assert.equal(
        await page.locator('[data-input="right"]').getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page.locator('[data-input="nitro"]').getAttribute("aria-pressed"),
        "true",
      );
      assert.ok(
        Number(await page.locator("#nitro").getAttribute("value")) < reserve,
      );
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      assert.equal(
        await page.locator('[data-input="right"]').getAttribute("aria-pressed"),
        "false",
      );
      assert.equal(
        await page.locator('[data-input="nitro"]').getAttribute("aria-pressed"),
        "false",
      );
      await page.keyboard.down("ArrowLeft");
      await page.clock.runFor(200);
      await page.keyboard.up("ArrowLeft");
    }
    // Native held steering and nitro, then cancellation through the public blur event.
    await page.keyboard.down("ArrowRight");
    await page.clock.runFor(250);
    await page.keyboard.up("ArrowRight");
    const beforeNitro = Number(
      await page.locator("#nitro").getAttribute("value"),
    );
    const scroll = await page.evaluate(() => scrollY);
    await page.keyboard.down("Space");
    await page.clock.runFor(400);
    await page.keyboard.up("Space");
    assert.ok(
      Number(await page.locator("#nitro").getAttribute("value")) < beforeNitro,
    );
    assert.equal(
      await page.evaluate(() => scrollY),
      scroll,
      "Space nitro cannot scroll page",
    );
    assert.ok(numeric(await page.locator("#distance").textContent()) > 5);
    await page.keyboard.press("Escape");
    assert.ok(
      await page
        .getByRole("heading", { name: "Tarik napas.", exact: false })
        .isVisible(),
    );
    const paused = await page.locator("#distance").textContent();
    await page.clock.runFor(1500);
    assert.equal(await page.locator("#distance").textContent(), paused);
    assert.equal(await page.evaluate(() => window.__parentRafAudit.pending), 0);
    await page.getByRole("button", { name: "Lanjutkan", exact: false }).click();
    await page.clock.runFor(32);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    assert.ok(
      await page
        .getByRole("heading", { name: "Tarik napas.", exact: false })
        .isVisible(),
    );
    await page.getByRole("button", { name: "Lanjutkan", exact: false }).click();
    await page.clock.runFor(32);
    // Back to center, ordinary controls only; traffic must produce a real crash.
    await page.keyboard.down("ArrowLeft");
    await page.clock.runFor(250);
    await page.keyboard.up("ArrowLeft");
    await page.screenshot({
      path: path.join(
        OUT,
        `${mode}-${touch ? "touch" : "desktop"}-playing.png`,
      ),
      fullPage: true,
    });
    for (
      let i = 0;
      i < 90 && (await page.locator("#phase").textContent()) === "MENGEMUDI";
      i++
    )
      await page.clock.runFor(1000);
    assert.ok(
      await page
        .getByRole("heading", { name: "Perjalanan berakhir.", exact: false })
        .isVisible(),
      "Real traffic must end an unattended center run",
    );
    const score = numeric(await page.locator("#score").textContent());
    assert.ok(score > 0);
    const save = await page.locator("#save-status").textContent();
    assert.ok(save.trim());
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("neon-drift.records.v1")),
    );
    assert.equal(stored.runs, 1);
    assert.equal(stored.bestScore, score);
    await page.clock.runFor(2000);
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("neon-drift.records.v1")),
      ),
      stored,
    );
    const raf = await page.evaluate(() => window.__parentRafAudit);
    assert.ok(raf.ticks > 0);
    assert.equal(raf.max, 1);
    assert.equal(raf.pending, 0);
    await page.screenshot({
      path: path.join(
        OUT,
        `${mode}-${touch ? "touch" : "desktop"}-results.png`,
      ),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Coba lagi", exact: false }).click();
    await page.clock.runFor(32);
    assert.ok(numeric(await page.locator("#distance").textContent()) < 10);
    await page.reload();
    await page.clock.runFor(64);
    assert.equal(await page.locator("#phase").textContent(), "SIAP");
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("neon-drift.records.v1")),
      ),
      stored,
    );
    assert.deepEqual(errors, []);
    if (mode === "offline")
      assert.deepEqual(
        requests.filter((u) => u !== target && !u.startsWith("data:")),
        [],
      );
    const result = {
      mode,
      touch,
      target,
      style,
      layout,
      score,
      save,
      stored,
      raf,
      requests: requests.length,
      errors,
    };
    fs.writeFileSync(
      path.join(OUT, `${mode}-${touch ? "touch" : "desktop"}-report.json`),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    await page
      .screenshot({
        path: path.join(OUT, `${mode}-${touch ? "touch" : "desktop"}-FAIL.png`),
        fullPage: true,
      })
      .catch(() => {});
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
