import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['renderer/src/**/*.test.ts'],
    environment: 'node'
  }
});
