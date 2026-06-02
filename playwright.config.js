import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration.
 * Tests run against the built dist/ served with `vite preview`.
 *
 * Env vars:
 *   E2E_BASE_URL — override the base URL (default: http://localhost:4173)
 */

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Start vite preview server before tests */
  webServer: {
    command: "npm run preview -- --port 4173",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
