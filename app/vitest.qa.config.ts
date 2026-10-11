import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// QA audit checks (E8). They live in ../tools/qa and import app code by relative path.
// Bare imports from tools/qa are resolved to app/node_modules via these aliases.
const nm = (p: string) => path.resolve(import.meta.dirname, 'node_modules', p);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@testing-library/react': nm('@testing-library/react'),
      '@testing-library/user-event': nm('@testing-library/user-event'),
      wanakana: nm('wanakana'),
      react: nm('react'),
      'react-dom': nm('react-dom'),
    },
  },
  server: { fs: { allow: [path.resolve(import.meta.dirname, '..')] } },
  test: {
    root: path.resolve(import.meta.dirname, '..'),
    include: ['tools/qa/**/*.qa.test.ts', 'tools/qa/**/*.qa.test.tsx'],
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(import.meta.dirname, 'src/test/setup.ts')],
    css: false,
  },
});
