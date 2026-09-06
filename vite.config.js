import { defineConfig } from 'vite';
import { resolve } from 'path';
import pkg from './package.json';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
