import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import { readConfigIntegration, readConfigPort } from '../cli/dev-port';
import { proxyToCampServer } from './proxy';

export const CAMP_ROUTE = '/__camp';

export interface PaperCampToolbarOptions {
  port?: number;
}

export function paperCamp(options: PaperCampToolbarOptions = {}): Plugin {
  let resolvedPort = options.port;
  let enabled = true;

  return {
    name: 'paper-camp-toolbar',
    apply: 'serve',
    async configureServer(server: ViteDevServer) {
      resolvedPort ??= (await readConfigPort(server.config.root)) ?? 3333;
      enabled = (await readConfigIntegration(server.config.root))?.enabled ?? true;
      if (!enabled) return;
      const port = resolvedPort;
      server.middlewares.use(CAMP_ROUTE, (req: IncomingMessage, res: ServerResponse) => {
        proxyToCampServer(req, res, { port });
      });
    },
    transformIndexHtml(html: string) {
      if (!enabled) return html;
      return html.replace(
        '</body>',
        `<script type="module" src="${CAMP_ROUTE}/toolbar.js"></script></body>`,
      );
    },
  };
}

export default paperCamp;
