const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/evidence/browser-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4187",
    headless: true,
    viewport: { width: 1366, height: 768 },
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        "/root/.hermes/tools/chromium-1208/chrome-linux/chrome",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: "artifacts/browser",
  webServer: process.env.NEON_NO_SERVER
    ? undefined
    : {
        command: "node scripts/server.cjs",
        url: "http://127.0.0.1:4187",
        reuseExistingServer: false,
        timeout: 10000,
      },
});
