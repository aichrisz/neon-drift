const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const source = pathToFileURL(path.resolve(__dirname, "../../index.html")).href;
test("native playable lifecycle tracer", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(source);
  await page.getByRole("button", { name: "Mulai mengemudi" }).click();
  await expect(page.locator("#phase")).toHaveText("MENGEMUDI");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(300);
  await page.keyboard.up("ArrowRight");
  await expect
    .poll(async () => Number(await page.locator("#distance").textContent()))
    .toBeGreaterThan(5);
  await page.keyboard.down("Space");
  await page.waitForTimeout(400);
  await page.keyboard.up("Space");
  await expect
    .poll(async () =>
      Number(await page.locator("#nitro").getAttribute("value")),
    )
    .toBeLessThan(55);
  await page.keyboard.press("p");
  await expect(
    page.getByRole("heading", { name: "Tarik napas." }),
  ).toBeVisible();
  const distance = await page.locator("#distance").textContent();
  await page.waitForTimeout(200);
  expect(await page.locator("#distance").textContent()).toBe(distance);
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  // Return to center using ordinary held input; await a real traffic collision.
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(300);
  await page.keyboard.up("ArrowLeft");
  await expect(
    page.getByRole("heading", { name: "Perjalanan berakhir." }),
  ).toBeVisible({ timeout: 45000 });
  await expect(page.locator("#save-status")).not.toBeEmpty();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page.locator("#phase")).toHaveText("MENGEMUDI");
  expect(Number(await page.locator("#distance").textContent())).toBe(0);
  expect(errors).toEqual([]);
});
