const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const axe = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
for (const [name, url] of [
  ["source", "http://127.0.0.1:4187/"],
  [
    "dist",
    pathToFileURL(path.resolve(__dirname, "../../dist/index.html")).href,
  ],
  [
    "offline",
    pathToFileURL(path.resolve(__dirname, "../../artifacts/Neon-Drift.html"))
      .href,
  ],
])
  test(
    name + " real play, screenshots and geometry",
    async ({ page, context }) => {
      const requests = [],
        errors = [];
      page.on("request", (r) => requests.push(r.url()));
      page.on("pageerror", (e) => errors.push(e.message));
      if (name === "offline") await context.setOffline(true);
      await page.goto(url);
      await page.addScriptTag({ content: axe });
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
          nodes: v.nodes.map((n) => n.target),
        })),
      );
      expect(violations).toEqual([]);
      for (const [width, height] of [
        [390, 844],
        [1366, 768],
      ]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({ path: `artifacts/${name}-${width}-ready.png` });
        const geometry = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          canvas: document
            .querySelector("canvas")
            .getBoundingClientRect()
            .toJSON(),
          controls: document
            .querySelector(".controls")
            .getBoundingClientRect()
            .toJSON(),
        }));
        expect(geometry.overflow).toBe(false);
        expect(geometry.canvas.height).toBeGreaterThan(300);
        expect(geometry.controls.bottom).toBeLessThanOrEqual(height);
      }
      await page.getByRole("button", { name: "Mulai mengemudi" }).click();
      await page.keyboard.down("ArrowLeft");
      await page.waitForTimeout(350);
      await page.keyboard.up("ArrowLeft");
      await page.waitForTimeout(300);
      expect(
        Number(await page.locator("#distance").textContent()),
      ).toBeGreaterThan(10);
      await page.screenshot({ path: `artifacts/${name}-running.png` });
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Lanjutkan" }),
      ).toBeVisible();
      expect(errors).toEqual([]);
      if (name === "offline") expect(requests).toEqual([url]);
    },
  );
