// Playwright config for the mobile layout-audit regression suite.
// Separate from the main e2e config so the collision/overflow guard in
// tests/mobile can be run on its own: `npx playwright test -c playwright.mobile.config.js`.
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:4173";

export default defineConfig({
  testDir: "./tests/mobile",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview -- --port 4173",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
