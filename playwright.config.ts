// playwright.config.ts
//
// Phase 2 Plan 02-08 — Playwright config for the QA-01 ship-gate smoke.
//
// CRITICAL contract (Phase 1 P05): the smoke MUST run against `next build`
// + `next start` output (NOT `next dev`). The smoke exercises the same code
// path Vercel deploys; otherwise dev-only React behaviors (StrictMode
// double-render, turbopack diffs, suppressed warnings) can hide regressions
// that real production users WILL hit.
//
// Conditional webServer: when PLAYWRIGHT_BASE_URL targets localhost, we
// launch a local server (`npm run build && npm run start`). When it points
// at a remote URL (Vercel preview, prod), we DO NOT relaunch a server —
// Playwright just hits the deployed instance.

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,                   // 60s per test — generous for slow CI
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 1 : 0,
  fullyParallel: false,              // we have ONE test file; no benefit
  globalTeardown: './tests/e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'] } },
  ],
  // Only launch a local server when baseURL points at localhost.
  // CRITICAL (Phase 1 P05 contract): use `next build` + `next start`,
  // NEVER `next dev` — the smoke must exercise the same code path Vercel
  // deploys, otherwise dev-only React behaviors (StrictMode double-render,
  // turbopack diffs, suppressed warnings) can hide regressions that
  // production users WILL hit.
  ...(baseURL.startsWith('http://localhost')
    ? {
        webServer: {
          command: 'npm run build && npm run start',
          url: 'http://localhost:3000/en',
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,           // build can take ~60-90s; start adds ~5s; pad to 240s for CI cold cache
          env: {
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
            SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? '',
            INVITE_CODE: process.env.INVITE_CODE ?? process.env.PLAYWRIGHT_INVITE_CODE ?? '',
            ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME ?? process.env.PLAYWRIGHT_ADMIN_NAME ?? '',
          },
        },
      }
    : {}),
});
