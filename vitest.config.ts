import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // <-- This makes all test functions global
    environment: 'node', // or "bun" if you want to experiment
  },
});
