/* Native browser acceptance helpers; DOM observations only, no live-state injection. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT =
  process.env.NEON_ROOT || require("node:path").resolve(__dirname, "../..");
const { chromium } = require(ROOT + "/node_modules/@playwright/test");
const OUT = path.join(ROOT, "artifacts", "parent");
const mode = process.argv[2] || "source";
const target = require("node:url").pathToFileURL(
  path.join(
    ROOT,
    mode === "offline"
      ? "artifacts/Neon-Drift.html"
      : mode === "dist"
        ? "dist/index.html"
        : "index.html",
  ),
).href;
const numeric = (s) =>
  Number(
    String(s)
      .replace(",", ".")
      .match(/-?\d+(?:\.\d+)?/)?.[0],
  );
async function auditLoop(page) {
  await page.evaluate(() => {
    const pending = new Set(),
      audit = { ticks: 0, max: 0, pending: 0 };
    window.__parentRafAudit = audit;
    const request = window.requestAnimationFrame.bind(window),
      cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      let id;
      id = request((t) => {
        pending.delete(id);
        audit.pending = pending.size;
        audit.ticks++;
        callback(t);
      });
      pending.add(id);
      audit.pending = pending.size;
      audit.max = Math.max(audit.max, pending.size);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      pending.delete(id);
      audit.pending = pending.size;
      return cancel(id);
    };
  });
}
async function geometry(page, selectors) {
  const data = await page.evaluate(
    (selectors) => ({
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      boxes: selectors.map((selector) => {
        const e = document.querySelector(selector);
        if (!e) return { selector, missing: true };
        const r = e.getBoundingClientRect();
        return {
          selector,
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          inViewport:
            r.x >= -1 &&
            r.y >= -1 &&
            r.right <= innerWidth + 1 &&
            r.bottom <= innerHeight + 1 &&
            r.width > 0 &&
            r.height > 0,
        };
      }),
    }),
    selectors,
  );
  assert.equal(data.overflow, false);
  assert.ok(
    data.boxes.every((b) => b.inViewport),
    JSON.stringify(data),
  );
  return data;
}
// Filled by parent after reading real HTML/controller IDs; no production mutation.
module.exports = {
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
};
