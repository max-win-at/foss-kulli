import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js', 'sw.js'],
      exclude: ['js/pwa-register.js'],
      reporter: ['text', 'html'],
    },
  },
});
