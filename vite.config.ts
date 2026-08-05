import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      plugins: [],
      resolve: {
        alias: {
          '@': resolve(__dirname, './src'),
          '@core': resolve(__dirname, './src/core'),
          '@cli': resolve(__dirname, './src/cli'),
          '@types': resolve(__dirname, './src/types'),
        },
      },
      test: {
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json-summary'],
          reportsDirectory: 'coverage',
        },
      },
    };
  }

  return {
    plugins: [
      dts({
        insertTypesEntry: true,
        include: ['src/core/**/*', 'src/types/**/*', 'src/vite/**/*', 'src/toolbar/**/*'],
      }),
    ],
    build: {
      lib: {
        entry: {
          core: resolve(__dirname, 'src/core/index.ts'),
          types: resolve(__dirname, 'src/types/index.ts'),
          cli: resolve(__dirname, 'src/cli/index.ts'),
          vite: resolve(__dirname, 'src/vite/index.ts'),
          toolbar: resolve(__dirname, 'src/toolbar/index.ts'),
        },
        formats: ['es'],
      },
      rollupOptions: {
        external: (id) =>
          id.startsWith('node:') ||
          ['commander', 'zustand', 'zod', 'node-pty', 'fs', 'path', 'url', 'http', 'vite'].includes(
            id,
          ),
        output: {
          entryFileNames: (chunk) => (chunk.name === 'toolbar' ? 'toolbar.js' : '[name]/index.js'),
          chunkFileNames: 'chunks/[name].[hash].js',
        },
      },
      outDir: 'dist',
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@core': resolve(__dirname, './src/core'),
        '@cli': resolve(__dirname, './src/cli'),
        '@types': resolve(__dirname, './src/types'),
      },
    },
  };
});
