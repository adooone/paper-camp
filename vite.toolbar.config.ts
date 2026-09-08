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
  // The toolbar's own icons are inline components (paper-logo.tsx, WandIcon), not
  // files under public/ — copying that folder here would ship public/img (and any
  // future doodle pack placed there) in the npm tarball, exactly what this build
  // must not do.
  publicDir: false,
  build: {
    outDir: 'dist/toolbar',
    emptyOutDir: true,
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
    // A locally-linked peer dependency (e.g. `pnpm add link:../paper-ui` while
    // testing an unreleased paper-ui change) resolves react/react-dom from its
    // OWN node_modules — a different real path than this package's copy, even
    // at the same version. Vite/Rollup dedupe by resolved path, not package
    // identity, so without this the bundle silently doubled both packages
    // (507kB → 708kB observed). dedupe forces one canonical resolution.
    dedupe: ['react', 'react-dom'],
  },
});
