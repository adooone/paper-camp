import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';
// Type-only — erased before esbuild bundles this config, so it does NOT pull the
// server's runtime graph (and its `@/` imports) into the config bundle.
import type { ApiMiddleware } from './src/app/server/api';
import type { AgentManagerState } from './src/app/server/agent';
import type { DeskCheckManagerState } from './src/app/server/desk-checks';
import type { DeskServiceManagerState } from './src/app/server/desk-services';
import type { PairingManagerState } from './src/app/server/pairing';
import type { StatusManagerState } from './src/app/server/status';

// src/app/server/** isn't a config dependency, so Vite never restarts for it — the
// watcher below clears `g.__paperCampApi` on change so loadApi() rebuilds it instead,
// after stashing the old instance's shared agent state object in
// `g.__paperCampAgentState` so the new instance is constructed against the very
// same Map/Set/scalars — a running task's process listeners (still owned by the
// old closure) and the new instance's getStatus()/subscribe() then read and write
// one shared container instead of drifting apart across the swap.
const g = globalThis as {
  __paperCampApi?: ApiMiddleware;
  __paperCampShutdownRegistered?: boolean;
  __paperCampAgentState?: AgentManagerState;
  __paperCampStatusState?: StatusManagerState;
  __paperCampServiceState?: DeskServiceManagerState;
  __paperCampCheckState?: DeskCheckManagerState;
  __paperCampPairingState?: PairingManagerState;
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
      // Separate from `pending`: overlapping reloads must await the same construction
      // rather than each starting their own, or the second clobbers g.__paperCampApi
      // with a fresh middleware built from state the first load already consumed.
      let inFlight: Promise<ApiMiddleware> | null = null;
      // Set once a hot-swap fails, so the next successful load knows to tell the
      // client the banner it raised is now stale.
      let reloadFailed = false;
      // Shared by the watcher's eager reload and the middleware's lazy one, so a
      // failure is logged/broadcast exactly once per rejected `pending`, however
      // it was triggered.
      const reportReloadFailure = (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        server.config.logger.error(
          `\n🛑 papercamp-api failed to reload — restart \`pnpm dev\`: ${message}\n`,
          { timestamp: true },
        );
        reloadFailed = true;
        server.ws.send({ type: 'custom', event: 'papercamp:server-reload-error', data: { message } });
      };
      const loadApi = async (): Promise<ApiMiddleware> => {
        if (g.__paperCampApi) return g.__paperCampApi;
        if (inFlight) return inFlight;
        inFlight = (async () => {
          const mod = (await server.ssrLoadModule('/src/app/server/api.ts')) as {
            createApiMiddleware: (
              root: string,
              agentState?: AgentManagerState,
              statusState?: StatusManagerState,
              serviceState?: DeskServiceManagerState,
              checkState?: DeskCheckManagerState,
              pairingState?: PairingManagerState,
            ) => ApiMiddleware;
          };
          const agentState = g.__paperCampAgentState;
          const statusState = g.__paperCampStatusState;
          const serviceState = g.__paperCampServiceState;
          const checkState = g.__paperCampCheckState;
          const pairingState = g.__paperCampPairingState;
          g.__paperCampAgentState = undefined;
          g.__paperCampStatusState = undefined;
          g.__paperCampServiceState = undefined;
          g.__paperCampCheckState = undefined;
          g.__paperCampPairingState = undefined;
          const api = mod.createApiMiddleware(
            process.cwd(),
            agentState,
            statusState,
            serviceState,
            checkState,
            pairingState,
          );
          g.__paperCampApi = api;
          if (reloadFailed) {
            reloadFailed = false;
            server.ws.send({ type: 'custom', event: 'papercamp:server-reload-ok' });
          }
          if (!g.__paperCampShutdownRegistered) {
            g.__paperCampShutdownRegistered = true;
            // Reads g.__paperCampApi at signal time, not a closed-over `api`, so it still
            // targets the live instance after a hot-reload has swapped it out.
            const shutdown = () => {
              void g.__paperCampApi?.agent.killCurrent();
              void g.__paperCampApi?.services.killAll();
            };
            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
          }
          return api;
        })();
        try {
          return await inFlight;
        } finally {
          inFlight = null;
        }
      };
      // Kicks off (and tracks) the reload itself rather than leaving it for the next
      // request, so an idle dev session with only an open SSE connection still gets
      // the failure banner the moment the watcher fires, not on the next HTTP hit.
      const triggerReload = (): Promise<ApiMiddleware> => {
        const attempt = loadApi().catch((err) => {
          reportReloadFailure(err);
          throw err;
        });
        pending = attempt;
        return attempt;
      };
      const serverRoot = resolve(__dirname, 'src/app/server');
      server.watcher.on('change', (file) => {
        if (!file.startsWith(serverRoot)) return;
        const mod = server.moduleGraph.getModuleById(file);
        if (mod) server.moduleGraph.invalidateModule(mod);
        if (g.__paperCampApi) {
          g.__paperCampAgentState = g.__paperCampApi.agent.getState();
          // Without this the in-flight check guard resets on every server edit, and a
          // fresh lint/test stacks on the ones still running until the box is starved.
          g.__paperCampStatusState = g.__paperCampApi.getStatusState();
          // Preserve running service child processes and their log buffers across the
          // hot-swap so a server edit doesn't orphan a dev server the user started.
          g.__paperCampServiceState = g.__paperCampApi.getServiceState();
          // Likewise keep the last check results so a running one-click check isn't
          // dropped and its stamp doesn't reset to stale on every server edit.
          g.__paperCampCheckState = g.__paperCampApi.getCheckState();
          // Preserve the pairing token and paired origins so a server edit doesn't
          // force the hosted client to re-pair mid-session.
          g.__paperCampPairingState = g.__paperCampApi.getPairingState();
        }
        g.__paperCampApi = undefined;
        // Fire-and-forget here: `reportReloadFailure` above already handles logging
        // and the ws banner; this just keeps Node from flagging the rejection as
        // unhandled when no request arrives to attach its own `.catch`.
        triggerReload().catch(() => {});
      });
      server.middlewares.use((req, res, next) => {
        pending ??= triggerReload();
        pending.then((api) => api(req, res, next)).catch(() => next());
      });
    },
  };
}

const paperUiRoot = resolve(__dirname, '../paper-ui');

// Local `file:../paper-ui` iteration: watches the built dist so a rebuilt
// local package reaches the browser without restarting `pnpm dev`. CSS and JS
// need separate handling — Vite's dependency pre-bundler (see
// optimizeDeps.exclude below) never touches CSS, so the CSS half needed no
// extra help beyond invalidating its module; the JS half is only reachable
// at all once optimizeDeps stops freezing it into a cached pre-bundle.
function watchPaperUi(): Plugin {
  return {
    name: 'watch-paper-ui',
    configureServer(server) {
      const watched = [
        resolve(paperUiRoot, 'dist/index.css'),
        resolve(paperUiRoot, 'dist/index.mjs'),
      ];
      for (const file of watched) server.watcher.add(file);
      // 'all' (not just 'change'): `pnpm add file:../paper-ui` swaps the
      // symlinked package's store entry rather than editing the existing
      // file in place, so chokidar reports 'unlink' + 'add', which a
      // change-only listener silently misses — the on-disk file was fresh
      // but the server kept transforming/serving its old cached copy.
      // Neither module has HMR accept boundaries wired up (paper-ui ships
      // one flat bundle), so a full reload is the correct signal — a
      // component-level hot-swap can't apply here anyway.
      server.watcher.on('all', (event, file) => {
        if (!watched.includes(file)) return;
        if (event === 'unlink') server.watcher.add(file);
        const mod = server.moduleGraph.getModuleById(file);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tsconfigPaths(), papercampApi(), watchPaperUi()],
  root: '.',
  base: './',
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
  optimizeDeps: {
    // Vite's dependency pre-bundler caches a dependency's whole module graph
    // into one frozen file at server startup and only re-scans it when its
    // own heuristics say to — which a same-version `file:../paper-ui` rebuild
    // never triggers. Excluding it drops that dependency out of the cache
    // entirely, so it's served (and watched — see watchPaperUi above) like a
    // normal source file instead, and a rebuilt local package reaches the
    // browser without a `pnpm dev` restart.
    exclude: ['@dendelion/paper-ui'],
    // Excluding paper-ui also excludes it from the optimizer's dependency
    // scan, so its own `import { createPortal } from 'react-dom'` (Menu,
    // Select, Modal) never gets the CJS→ESM named-export shim that scan
    // normally produces — the browser then fails loading react-dom's raw
    // CJS entry directly. paper-camp only imports `react-dom/client`
    // itself, so the plain `react-dom` specifier was never optimized by
    // auto-discovery either; forcing both in fixes it for both import paths.
    include: ['react-dom', 'react-dom/client'],
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
    // A linked ../paper-ui resolves react from its own node_modules, so hooks run
    // against a second React instance and every render throws "Cannot read
    // properties of null (reading 'useState')". Harmless when paper-ui comes from
    // the registry; required whenever it is linked for local development.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@app': resolve(__dirname, './src/app'),
      '@cli': resolve(__dirname, './src/cli'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
});
