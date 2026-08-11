import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import { readConfigIntegration, readConfigPort } from '../cli/dev-port';
import { ROUTE_ATTRIBUTE, TOOLBAR_SCRIPT_ID } from '../toolbar/route-attribute';
import { proxyToCampServer } from './proxy';

export const CAMP_ROUTE = '/paper-camp';

export interface PaperCampToolbarOptions {
  port?: number;
}

export function paperCamp(options: PaperCampToolbarOptions = {}): Plugin {
  let resolvedPort = options.port;
  let enabled = true;
  let route = CAMP_ROUTE;

  return {
    name: 'paper-camp-toolbar',
    apply: 'serve',
    async configureServer(server: ViteDevServer) {
      resolvedPort ??= (await readConfigPort(server.config.root)) ?? 3333;
      const integration = await readConfigIntegration(server.config.root);
      const isProduction = server.config.mode === 'production';
      enabled =
        (integration?.enabled ?? true) && (!isProduction || integration?.allowProduction === true);
      route = integration?.route ?? CAMP_ROUTE;
      if (!enabled) return;
      const port = resolvedPort;
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const [path, query] = (req.url ?? '').split('?', 2);
        if (path !== route) {
          next();
          return;
        }
        res.statusCode = 308;
        res.setHeader('Location', query ? `${route}/?${query}` : `${route}/`);
        res.end();
      });
      server.middlewares.use(route, (req: IncomingMessage, res: ServerResponse) => {
        proxyToCampServer(req, res, { port, mount: route });
      });
    },
    transformIndexHtml(html: string) {
      if (!enabled) return html;
      return html.replace(
        '</body>',
        `<script type="module" id="${TOOLBAR_SCRIPT_ID}" ${ROUTE_ATTRIBUTE}="${route}" src="${route}/toolbar.js"></script></body>`,
      );
    },
  };
}

export default paperCamp;
