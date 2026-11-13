/* global process */
import { defineConfig, devices } from '@playwright/test';
import { env } from './e2e/helpers/seed.mjs';

// Three widths in both themes (QA README "View: all"). One worker: every spec shares the one local database.
const sizes = { desktop: { width: 1280, height: 800 }, tablet: { width: 768, height: 1024 }, phone: { width: 375, height: 812 } };
const channel = process.env.PW_CHANNEL; // e.g. msedge when the bundled Chromium is not installed
const projects = Object.entries(sizes).flatMap(([name, viewport]) =>
  ['light', 'dark'].map((colorScheme) => ({
    name: `${name}-${colorScheme}`,
    use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}), viewport, colorScheme, hasTouch: name === 'phone' },
  })));

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects,
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    env: { VITE_SUPABASE_URL: env().VITE_SUPABASE_URL ?? '', VITE_SUPABASE_PUBLISHABLE_KEY: env().VITE_SUPABASE_PUBLISHABLE_KEY ?? '' },
  },
});
