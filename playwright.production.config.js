import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({
    ...base,
    testMatch: 'pvp.spec.js',
    use: { ...base.use, baseURL: 'http://127.0.0.1:4317' },
    webServer: { command: 'npm start', url: 'http://127.0.0.1:4317/healthz', reuseExistingServer: !process.env.CI }
});
