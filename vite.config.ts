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
    };
  }

  return {
    plugins: [
      dts({
        insertTypesEntry: true,
        include: ['src/core/**/*', 'src/types/**/*'],
      }),
    ],
    build: {
      lib: {
        entry: {
          core: resolve(__dirname, 'src/core/index.ts'),
          types: resolve(__dirname, 'src/types/index.ts'),
          cli: resolve(__dirname, 'src/cli/index.ts'),
        },
        formats: ['es'],
      },
      rollupOptions: {
        external: (id) =>
          id.startsWith('node:') ||
          ['react', 'react-dom', 'commander', 'zustand', 'zod', 'fs', 'path', 'url', 'http'].includes(id),
        output: {
          entryFileNames: '[name]/index.js',
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
