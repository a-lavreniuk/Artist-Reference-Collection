import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  publicDir: path.resolve(__dirname, 'public'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@arc-main-shared': path.resolve(__dirname, '../src/main/shared')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      treeshake: {
        moduleSideEffects: (id) => id.includes(`${path.sep}debug${path.sep}`)
      },
      input: {
        main: path.resolve(__dirname, 'index.html'),
        screenshotPicker: path.resolve(__dirname, 'screenshot-picker.html'),
        screenshotWindowPicker: path.resolve(__dirname, 'screenshot-window-picker.html'),
        loadingScreen: path.resolve(__dirname, 'loading-screen.html'),
        cardViewer: path.resolve(__dirname, 'card-viewer.html')
      }
    }
  }
});
