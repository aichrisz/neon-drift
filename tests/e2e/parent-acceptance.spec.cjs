/* Parent coverage expansion: accessibility in all actual game phases. */
const { test, expect } = require("@playwright/test");
const AXE = require.resolve("axe-core/axe.min.js");
test("focused pause, key release, lost capture and simulated lifecycle signals freeze safely", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByRole("button", { name: "Mulai mengemudi" }).click();
  await page.clock.runFor(64);
  await page.keyboard.down("ArrowRight");
  await expect(page.locator('[data-input="right"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.up("ArrowRight");
  await expect(page.locator('[data-input="right"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  const left = page.locator('[data-input="left"]'),
    box = await left.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(left).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
  await left.evaluate((el) => {
    if (!el.hasPointerCapture(1))
      throw new Error("Native mouse capture missing");
    el.releasePointerCapture(1);
  });
  // Capture changes are processed on the next pointer event, not synchronously.
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2);
  await page.clock.runFor(32);
  await expect(left).toHaveAttribute("aria-pressed", "false");
  await page.mouse.up();
  await page.locator("#decorations").focus();
  await page.keyboard.press("p");
  await expect(page.locator("#phase")).toHaveText("JEDA");
  for (const signal of ["pagehide", "hidden", "blur"]) {
    await page.getByRole("button", { name: "Lanjutkan" }).click();
    await page.clock.runFor(64);
    // Simulated platform lifecycle state only; never mutate the game instance.
    await page.evaluate((signal) => {
      if (signal === "hidden") {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        delete document.hidden;
      } else window.dispatchEvent(new Event(signal));
    }, signal);
    await expect(page.locator("#phase")).toHaveText("JEDA");
    const distance = await page.locator("#distance").textContent();
    await page.clock.runFor(1000);
    await expect(page.locator("#distance")).toHaveText(distance);
    await expect(page.locator('[data-input="left"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  }
});
test("pause focus follows enabled running controls on start resume and replay", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    crypto.getRandomValues = (a) => {
      a.fill(7);
      return a;
    };
  });
  await page.goto("/");
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByRole("button", { name: "Mulai mengemudi" }).click();
  await page.clock.runFor(64);
  await expect(page.locator("#pause")).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await page.clock.runFor(64);
  await expect(page.locator("#pause")).toBeFocused();
  for (let i = 0; i < 140; i++) await page.clock.fastForward(100);
  await expect(page.locator("#phase")).toHaveText("SELESAI");
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await page.clock.runFor(64);
  await expect(page.locator("#pause")).toBeFocused();
});
async function audit(page, phase, rows) {
  await page.clock.resume();
  const violations = await page.evaluate(async () =>
    (
      await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
        },
      })
    ).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  );
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 100)),
  );
  rows.push({ phase, violations });
  expect(violations, phase).toEqual([]);
}
test("axe ready, driving, paused and actual crash/results without exclusions", async ({
  page,
}, info) => {
  const rows = [];
  await page.addInitScript(() => {
    crypto.getRandomValues = (a) => {
      a.fill(7);
      return a;
    };
  });
  await page.clock.install();
  await page.goto("/");
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addScriptTag({ path: AXE });
  try {
    await audit(page, "ready", rows);
    await page.getByRole("button", { name: "Mulai mengemudi" }).click();
    await page.clock.runFor(64);
    await audit(page, "running", rows);
    await page.keyboard.press("Escape");
    await audit(page, "paused", rows);
    await page.getByRole("button", { name: "Lanjutkan" }).click();
    await page.clock.runFor(64);
    for (
      let i = 0;
      i < 150 && (await page.locator("#phase").textContent()) === "MENGEMUDI";
      i++
    )
      await page.clock.fastForward(100);
    await expect(page.locator("#phase")).toHaveText("SELESAI");
    await audit(page, "results", rows);
  } finally {
    await info.attach("parent-axe-phases", {
      body: JSON.stringify(rows, null, 2),
      contentType: "application/json",
    });
  }
});
