import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (stage E8 QA). Runs against the Docker build (nginx) on http://localhost:8081 by default:
 *   docker compose up -d --build   (repo root)
 *   npm run test:e2e               (app/)
 * Override with BASE_URL=http://localhost:5173 for the dev server.
 * Test files are *.e2e.ts so Vitest (`npm test`, also run in the Docker build) never picks them up.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8081',
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
