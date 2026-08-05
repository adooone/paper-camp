import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

// A separate pass from vite.config.ts's lib build: the toolbar is a browser app
// artifact embedded in a host page, not a downstream-consumed lib entry, so it
// needs everything (react, react-dom, zustand, paper-ui) bundled in with no
// externals and NODE_ENV substituted, rather than left for a consumer's bundler.
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist/app',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/toolbar/index.ts'),
      formats: ['es'],
      fileName: () => 'toolbar.js',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@app': resolve(__dirname, './src/app'),
      '@cli': resolve(__dirname, './src/cli'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
});
