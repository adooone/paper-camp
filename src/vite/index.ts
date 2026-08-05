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
      const integration = await readConfigIntegration(server.config.root);
      const isProduction = server.config.mode === 'production';
      enabled =
        (integration?.enabled ?? true) && (!isProduction || integration?.allowProduction === true);
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
