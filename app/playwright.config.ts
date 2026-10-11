import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (QA E8 / Q2). Runs against the Docker build (nginx) on http://localhost:8081 by default:
 *   docker compose up -d --build   (repo root)
 *   npm run test:e2e               (app/, desktop Chromium: journeys, practice, invariants, stage-2 games…)
 *   npm run test:e2e:mobile        (Pixel 7 + iPhone 14 emulation: the user's mobile feedback, *.mobile.e2e.ts)
 *   npm run test:e2e:pages         (static GitHub Pages build under /nihongo-dojo/, served by scripts/serve-pages.mjs)
 * Override with BASE_URL=http://localhost:5173 for the dev server.
 * Test files are *.e2e.ts so Vitest (`npm test`, also run in the Docker build) never picks them up.
 *
 * iPhone 14 runs on Chromium with the iPhone descriptor (viewport, DPR, UA, touch): Playwright's WebKit needs system
 * libraries this host does not have. So it checks layout at iPhone size, not Safari's engine.
 */
const PAGES_PORT = Number(process.env.PAGES_PORT ?? 4173);
const pagesRun = process.argv.some((a) => a.includes('pages'));

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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: ['**/*.mobile.e2e.ts', '**/*.pages.e2e.ts'] },
    { name: 'pixel7', use: { ...devices['Pixel 7'] }, testMatch: '**/*.mobile.e2e.ts' },
    { name: 'iphone14', use: { ...devices['iPhone 14'], browserName: 'chromium' }, testMatch: '**/*.mobile.e2e.ts' },
    {
      name: 'pages',
      use: { ...devices['Pixel 7'], baseURL: `http://localhost:${PAGES_PORT}/nihongo-dojo/` },
      testMatch: '**/*.pages.e2e.ts',
    },
  ],
  // Only for the static-build project: build with VITE_BASE and serve like GitHub Pages (404.html fallback).
  webServer: pagesRun
    ? {
        command: `VITE_BASE=/nihongo-dojo/ npm run build && node scripts/serve-pages.mjs /nihongo-dojo/ ${PAGES_PORT}`,
        url: `http://localhost:${PAGES_PORT}/nihongo-dojo/`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
