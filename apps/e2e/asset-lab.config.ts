import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './asset-lab', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4178', viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'node ../../tools/asset-lab/server.mjs', url: 'http://127.0.0.1:4178', reuseExistingServer: !process.env.CI },
});
