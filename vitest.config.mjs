import { defineConfig } from 'vitest/config';

// The add-on ships as plain ES modules with no build step. These tests cover
// the pure, browser-independent logic only; modules that call browser.* APIs
// are exercised at the function level (the APIs are not touched at import time).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    globals: false,
  },
});
