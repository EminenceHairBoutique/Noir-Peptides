// Playwright config for the mobile layout-audit regression suite.
// Separate from the main e2e config so the collision/overflow guard in
// tests/mobile can be run on its own: `npx playwright test -c playwright.mobile.config.js`.
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:4173";
// Opt cycle 12 (4.12): a remote base URL (a deployment) has nothing to start —
// Playwright would otherwise refuse to run ("… is already used") under CI, which
// is why the production post-deploy smoke had never executed. No webServer then.
const REMOTE = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(BASE_URL);

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
  ...(REMOTE ? {} : {
    webServer: {
      command: "npm run preview -- --port 4173",
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  }),
});
