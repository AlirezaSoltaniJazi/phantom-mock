import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './manifest.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const isLocal = mode === 'unpacked';
  const activeManifest = isLocal
    ? {
        ...manifest,
        name: `${manifest.name} - Local`,
        action: {
          ...manifest.action,
          default_title: `${manifest.action.default_title} (Local)`,
        },
      }
    : manifest;

  return {
    plugins: [react(), crx({ manifest: activeManifest })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: {
          panel: 'src/devtools/panel.html',
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5174,
      },
    },
  };
});
