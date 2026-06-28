import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';
import { type ApiMiddleware, createApiMiddleware } from './src/app/server/api';

// Vite restarts its dev middleware in-process on every server-side file change
// (not just on Ctrl-C), which would otherwise re-run createApiMiddleware() and
// silently orphan any agent task the previous instance was tracking — the new
// instance's `current` starts at null while the old child process keeps running,
// invisible to /api/agent/status. Persisting on globalThis survives those restarts.
const g = globalThis as { __paperCampApi?: ApiMiddleware; __paperCampShutdownRegistered?: boolean };

function papercampApi(): Plugin {
  return {
    name: 'papercamp-api',
    configureServer(server) {
      const api = g.__paperCampApi ?? createApiMiddleware(process.cwd());
      g.__paperCampApi = api;
      server.middlewares.use(api);
      if (!g.__paperCampShutdownRegistered) {
        g.__paperCampShutdownRegistered = true;
        const shutdown = () => {
          api.agent.killCurrent();
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      }
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
