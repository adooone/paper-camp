import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';
// Type-only — erased before esbuild bundles this config, so it does NOT pull the
// server's runtime graph (and its `@/` imports) into the config bundle.
import type { ApiMiddleware } from './src/app/server/api';

// Nothing invalidates `g.__paperCampApi` when src/app/server/** changes — those
// files aren't config dependencies, so Vite never restarts for them, and loadApi()
// below unconditionally returns the cached instance forever; only killing `pnpm dev`
// clears it. The one restart that *can* happen in-process is editing this config
// file itself, which Vite reinitializes via configureServer — globalThis survives
// that so the live agent task (AgentManager's `tasks`/`lastLaunchedId`, and its
// running child process) isn't silently orphaned mid-run.
const g = globalThis as { __paperCampApi?: ApiMiddleware; __paperCampShutdownRegistered?: boolean };

function papercampApi(): Plugin {
  return {
    name: 'papercamp-api',
    configureServer(server) {
      // Load the API middleware through Vite's SSR module pipeline rather than a
      // static top-level import. A static import makes esbuild bundle the whole
      // server graph into this config file, evaluated in raw Node where the `@/`
      // alias does not resolve — so any `@/` value import under src/app/server
      // crashed `pnpm dev` at config load. ssrLoadModule resolves `@/` (and TS)
      // the same way the app build does, so server code can use `@/` freely.
      let pending: Promise<ApiMiddleware> | null = null;
      const loadApi = async (): Promise<ApiMiddleware> => {
        if (g.__paperCampApi) return g.__paperCampApi;
        const mod = (await server.ssrLoadModule('/src/app/server/api.ts')) as {
          createApiMiddleware: (root: string) => ApiMiddleware;
        };
        const api = mod.createApiMiddleware(process.cwd());
        g.__paperCampApi = api;
        if (!g.__paperCampShutdownRegistered) {
          g.__paperCampShutdownRegistered = true;
          const shutdown = () => api.agent.killCurrent();
          process.on('SIGINT', shutdown);
          process.on('SIGTERM', shutdown);
        }
        return api;
      };
      server.middlewares.use((req, res, next) => {
        pending ??= loadApi();
        pending
          .then((api) => api(req, res, next))
          .catch((err) => {
            server.config.logger.error(`papercamp-api failed to load: ${err}`);
            next();
          });
      });
    },
  };
}

const paperUiRoot = resolve(__dirname, '../paper-ui');

function watchPaperUi(): Plugin {
  return {
    name: 'watch-paper-ui',
    configureServer(server) {
      const cssPath = resolve(paperUiRoot, 'dist/index.css');
      server.watcher.add(cssPath);
      server.watcher.on('change', (file) => {
        if (file === cssPath) {
          const mod = server.moduleGraph.getModuleById(cssPath);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tsconfigPaths(), papercampApi(), watchPaperUi()],
  root: '.',
  publicDir: 'public',
  server: {
    port: 3333,
    host: '0.0.0.0',
    cors: true,
    // Allow all hosts (Tailscale, LAN, etc.)
    allowedHosts: true,
    watch: {
      ignored: (path) => {
        // Ignore all node_modules except the symlinked local paper-ui package
        if (!path.includes('node_modules')) return false;
        return !path.includes('@dendelion/paper-ui');
      },
    },
  },
  build: {
    outDir: 'dist/app',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
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
