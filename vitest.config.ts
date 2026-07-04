import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react({ jsxRuntime: 'automatic' })],
  esbuild: {
    jsx: 'automatic'
  },
  resolve: {
    alias: {
      '@arc-main-shared': path.resolve(__dirname, 'src/main/shared')
    }
  },
  test: {
    include: [
      'renderer/src/**/*.test.ts',
      'renderer/src/**/*.test.tsx',
      'src/main/**/*.test.ts'
    ],
    environment: 'node'
  }
});
