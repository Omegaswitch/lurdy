import { defineConfig } from '@playwright/test';

// Runs against the development Supabase project with fictional data (supabase/seed-dev.sql).
export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', locale: 'cs-CZ', timezoneId: 'Europe/Prague', trace: 'retain-on-failure' },
  webServer: [
    { command: 'pnpm --filter @lurdy/admin dev --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true, cwd: '..' },
  ],
});
