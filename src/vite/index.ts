import type { Plugin, ViteDevServer } from 'vite';
import { readConfigIntegration } from '../cli/dev-port';
import { ROUTE_ATTRIBUTE, TOOLBAR_SCRIPT_ID } from '../toolbar/route-attribute';
import { resolveDaemonTarget } from './daemon-target';

export const TOOLBAR_OFF_MESSAGE =
  'paper-camp: toolbar off — run `paper-camp start` and register this repo with `paper-camp init`';

export interface PaperCampToolbarOptions {
  port?: number;
}

export function paperCamp(options: PaperCampToolbarOptions = {}): Plugin {
  let scriptTag: string | undefined;

  return {
    name: 'paper-camp-toolbar',
    apply: 'serve',
    async configureServer(server: ViteDevServer) {
      const integration = await readConfigIntegration(server.config.root);
      const isProduction = server.config.mode === 'production';
      const enabled =
        (integration?.enabled ?? true) && (!isProduction || integration?.allowProduction === true);
      if (!enabled) return;

      const target = await resolveDaemonTarget(server.config.root, options.port);
      if (!target) {
        console.log(TOOLBAR_OFF_MESSAGE);
        return;
      }

      const mount = `/p/${target.slug}`;
      scriptTag = `<script type="module" id="${TOOLBAR_SCRIPT_ID}" ${ROUTE_ATTRIBUTE}="${mount}" src="${target.origin}${mount}/toolbar.js"></script>`;
    },
    transformIndexHtml(html: string) {
      if (!scriptTag) return html;
      return html.replace('</body>', `${scriptTag}</body>`);
    },
  };
}

export default paperCamp;
