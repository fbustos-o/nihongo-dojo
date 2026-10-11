import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** GitHub Pages has no SPA fallback: it serves 404.html for unknown paths, so ship a copy of index.html. */
function spaFallback404(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const index = bundle['index.html'];
        if (index && index.type === 'asset') this.emitFile({ type: 'asset', fileName: '404.html', source: index.source });
      },
    },
  };
}

/** `VITE_BASE=/nihongo-dojo/` for GitHub Pages; defaults to `/` (Docker/nginx). Always starts and ends with a slash. */
function normalizeBase(raw: string | undefined): string {
  let base = (raw ?? '/').trim() || '/';
  if (!base.startsWith('/')) base = `/${base}`;
  return base.endsWith('/') ? base : `${base}/`;
}

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

export default defineConfig({
  base: normalizeBase(env.VITE_BASE),
  plugins: [react(), spaFallback404()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
