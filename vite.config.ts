import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const runtimeDependencies = Object.keys(
  (JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as {
    dependencies?: Record<string, string>;
  }).dependencies ?? {},
);

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
        include: ['src/core/**/*', 'src/types/**/*', 'src/vite/**/*'],
      }),
    ],
    // None of this build's entries (core, types, cli, vite) are a browser app — copying
    // public/ into dist/ here served no purpose and risked carrying public/img (and any
    // future doodle pack placed there) into a runtime-only tarball.
    publicDir: false,
    build: {
      lib: {
        entry: {
          core: resolve(__dirname, 'src/core/index.ts'),
          types: resolve(__dirname, 'src/types/index.ts'),
          cli: resolve(__dirname, 'src/cli/index.ts'),
          vite: resolve(__dirname, 'src/vite/index.ts'),
        },
        formats: ['es'],
      },
      rollupOptions: {
        // Everything installed at runtime stays a runtime import: every `dependencies`
        // entry (and its subpaths) plus Node's built-ins, with or without the `node:` prefix.
        external: (id) =>
          id.startsWith('node:') ||
          builtinModules.includes(id) ||
          runtimeDependencies.some((name) => id === name || id.startsWith(`${name}/`)) ||
          ['zustand', 'vite'].includes(id),
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
