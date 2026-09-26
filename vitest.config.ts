import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:3010/operaciones' } },
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
  },
});
