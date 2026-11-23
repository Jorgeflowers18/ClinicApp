import { defineConfig } from "@playwright/test"

/**
 * Pruebas E2E contra el back real. Se corren con `npm run test:e2e` (`scripts/run-api-e2e.mjs`), que crea la
 * base `clinicapp_e2e`, levanta la API y un Vite propios, y al terminar borra la base.
 */
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  timeout: 90000,
  expect: { timeout: 15000 },
  // Las pruebas comparten la base y el límite de inicios de sesión de la API (20 por minuto).
  workers: 1,
  use: {
    actionTimeout: 15000,
    baseURL: process.env.CLINIC_TEST_URL || "http://127.0.0.1:5185",
    channel: "chrome",
    timezoneId: "America/Guayaquil",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
})
