import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "npm.cmd exec -w @unioportunidades/api -- tsx ../../e2e/server.ts",
      url: "http://127.0.0.1:3101/api/v1/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command:
        "npm.cmd run dev -w @unioportunidades/web -- --host 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      env: {
        VITE_API_BASE_URL: "http://127.0.0.1:3101/api/v1",
        VITE_SUPABASE_URL: "http://127.0.0.1:3101",
        VITE_SUPABASE_ANON_KEY: "local-test-public-key",
      },
    },
  ],
});
