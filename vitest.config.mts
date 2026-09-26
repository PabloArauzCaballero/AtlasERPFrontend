import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Pruebas unitarias de `lib/`. Sólo `tests/unit`: los E2E de `e2e/` son de Playwright.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['tests/unit/**/*.test.ts'] },
});
