import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:15173', channel: 'chrome', headless: true, screenshot: 'only-on-failure' },
  webServer: [
    {
      command: 'mvnw.cmd -o spring-boot:run "-Dspring-boot.run.arguments=--server.port=18080"',
      cwd: fileURLToPath(new URL('../backend', import.meta.url)),
      url: 'http://localhost:18080/api/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 15173 --strictPort',
      url: 'http://127.0.0.1:15173',
      env: { DATADEMO_API_TARGET: 'http://localhost:18080' },
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
})
