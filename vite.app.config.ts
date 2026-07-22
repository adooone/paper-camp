import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';
// Type-only — erased before esbuild bundles this config, so it does NOT pull the
// server's runtime graph (and its `@/` imports) into the config bundle.
import type { ApiMiddleware } from './src/app/server/api';
import type { AgentManagerState } from './src/app/server/agent';

// src/app/server/** isn't a config dependency, so Vite never restarts for it — the
// watcher below clears `g.__paperCampApi` on change so loadApi() rebuilds it instead,
// after exporting the old instance's in-flight agent tasks/SSE clients into
// `g.__paperCampAgentState` so the new instance can import them and a running task
// (and its child process) survives the swap instead of being silently orphaned.
const g = globalThis as {
  __paperCampApi?: ApiMiddleware;
  __paperCampShutdownRegistered?: boolean;
  __paperCampAgentState?: AgentManagerState;
};

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
      // Set once a hot-swap fails, so the next successful load knows to tell the
      // client the banner it raised is now stale.
      let reloadFailed = false;
      const loadApi = async (): Promise<ApiMiddleware> => {
        if (g.__paperCampApi) return g.__paperCampApi;
        const mod = (await server.ssrLoadModule('/src/app/server/api.ts')) as {
          createApiMiddleware: (root: string) => ApiMiddleware;
        };
        const api = mod.createApiMiddleware(process.cwd());
        if (g.__paperCampAgentState) {
          api.agent.importState(g.__paperCampAgentState);
          g.__paperCampAgentState = undefined;
        }
        g.__paperCampApi = api;
        if (reloadFailed) {
          reloadFailed = false;
          server.ws.send({ type: 'custom', event: 'papercamp:server-reload-ok' });
        }
        if (!g.__paperCampShutdownRegistered) {
          g.__paperCampShutdownRegistered = true;
          // Reads g.__paperCampApi at signal time, not a closed-over `api`, so it still
          // targets the live instance after a hot-reload has swapped it out.
          const shutdown = () => g.__paperCampApi?.agent.killCurrent();
          process.on('SIGINT', shutdown);
          process.on('SIGTERM', shutdown);
        }
        return api;
      };
      const serverRoot = resolve(__dirname, 'src/app/server');
      server.watcher.on('change', (file) => {
        if (!file.startsWith(serverRoot)) return;
        const mod = server.moduleGraph.getModuleById(file);
        if (mod) server.moduleGraph.invalidateModule(mod);
        if (g.__paperCampApi) g.__paperCampAgentState = g.__paperCampApi.agent.exportState();
        g.__paperCampApi = undefined;
        pending = null;
      });
      server.middlewares.use((req, res, next) => {
        pending ??= loadApi();
        pending
          .then((api) => api(req, res, next))
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            // A hot-swap that throws leaves `pending` rejected until the next edit under
            // src/app/server/**, so every request fails the same way until then — loud on
            // both ends since a silent 500 is exactly the footgun this phase closes.
            server.config.logger.error(
              `\n🛑 papercamp-api failed to reload — restart \`pnpm dev\`: ${message}\n`,
              { timestamp: true },
            );
            reloadFailed = true;
            server.ws.send({ type: 'custom', event: 'papercamp:server-reload-error', data: { message } });
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
