import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Exposes the tweak catalog to the renderer's demo mode (used when not running inside Electron on Windows).
function catalogModule(): Plugin {
  const id = 'virtual:catalog';
  return {
    name: 'tickrate-catalog',
    resolveId: (source) => (source === id ? '\0' + id : null),
    load(source) {
      if (source !== '\0' + id) return null;
      const file = require.resolve('./electron/catalog/index.cjs');
      for (const key of Object.keys(require.cache)) if (key.includes('/electron/catalog/') || key.includes('\\electron\\catalog\\')) delete require.cache[key];
      const catalog = require(file);
      return `export default ${JSON.stringify({ ...catalog, version: process.env.npm_package_version || 'dev' })};`;
    },
  };
}

// Strict Content-Security-Policy for the packaged app (the dev server needs inline scripts for HMR).
function csp(): Plugin {
  return {
    name: 'tickrate-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:" />`,
      ),
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), catalogModule(), csp()],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
