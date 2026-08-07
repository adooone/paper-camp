import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ROUTE_ATTRIBUTE, TOOLBAR_SCRIPT_ID } from '../toolbar/route-attribute';
import { CAMP_ROUTE, type PaperCampToolbarOptions, paperCamp } from './index';
import { proxyToCampServer } from './proxy';

vi.mock('./proxy', () => ({ proxyToCampServer: vi.fn() }));

interface FakeServer {
  config: { root: string; mode?: string };
  middlewares: { use: ReturnType<typeof vi.fn> };
}

function configureServer(options: PaperCampToolbarOptions, server: FakeServer): Promise<void> {
  const plugin = paperCamp(options);
  return (plugin.configureServer as unknown as (server: FakeServer) => Promise<void>)(server);
}

describe('paperCamp', () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeRoot(config: unknown): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'paper-camp-vite-'));
    dirs.push(root);
    await mkdir(join(root, 'papercamp'), { recursive: true });
    await writeFile(join(root, 'papercamp', 'config.json'), JSON.stringify(config));
    return root;
  }

  it('is dev-only', () => {
    expect(paperCamp().apply).toBe('serve');
  });

  it('injects a toolbar script tag before </body>', () => {
    const plugin = paperCamp();
    const transform = plugin.transformIndexHtml as (html: string) => string;
    const html = transform('<html><body><div id="root"></div></body></html>');
    expect(html).toContain(
      `<script type="module" id="${TOOLBAR_SCRIPT_ID}" ${ROUTE_ATTRIBUTE}="${CAMP_ROUTE}" src="${CAMP_ROUTE}/toolbar.js"></script></body>`,
    );
  });

  it('proxies to the port from papercamp/config.json', async () => {
    const root = await makeRoot({ port: 4242 });
    const use = vi.fn();
    await configureServer({}, { config: { root }, middlewares: { use } });

    expect(use).toHaveBeenCalledWith(CAMP_ROUTE, expect.any(Function));
    const middleware = use.mock.calls[0][1] as (req: unknown, res: unknown) => void;
    const req = {};
    const res = {};
    middleware(req, res);
    expect(proxyToCampServer).toHaveBeenCalledWith(req, res, { port: 4242, mount: CAMP_ROUTE });
  });

  it('prefers an explicit port option over config.json', async () => {
    const root = await makeRoot({ port: 4242 });
    const use = vi.fn();
    await configureServer({ port: 9999 }, { config: { root }, middlewares: { use } });

    const middleware = use.mock.calls[0][1] as (req: unknown, res: unknown) => void;
    const req = {};
    const res = {};
    middleware(req, res);
    expect(proxyToCampServer).toHaveBeenCalledWith(req, res, { port: 9999, mount: CAMP_ROUTE });
  });

  it('skips the proxy middleware and script injection when integration.toolbar.enabled is false', async () => {
    const root = await makeRoot({ port: 4242, integration: { toolbar: { enabled: false } } });
    const use = vi.fn();
    const plugin = paperCamp();
    await (plugin.configureServer as unknown as (server: FakeServer) => Promise<void>)({
      config: { root },
      middlewares: { use },
    });

    expect(use).not.toHaveBeenCalled();
    const transform = plugin.transformIndexHtml as (html: string) => string;
    const html = transform('<html><body><div id="root"></div></body></html>');
    expect(html).not.toContain('toolbar.js');
  });

  it('skips the proxy middleware and script injection when mode is production', async () => {
    const root = await makeRoot({ port: 4242 });
    const use = vi.fn();
    const plugin = paperCamp();
    await (plugin.configureServer as unknown as (server: FakeServer) => Promise<void>)({
      config: { root, mode: 'production' },
      middlewares: { use },
    });

    expect(use).not.toHaveBeenCalled();
    const transform = plugin.transformIndexHtml as (html: string) => string;
    const html = transform('<html><body><div id="root"></div></body></html>');
    expect(html).not.toContain('toolbar.js');
  });

  it('mounts the proxy and injects the script at a configured integration.route', async () => {
    const root = await makeRoot({ port: 4242, integration: { route: '/__toolbar' } });
    const use = vi.fn();
    const plugin = paperCamp();
    await (plugin.configureServer as unknown as (server: FakeServer) => Promise<void>)({
      config: { root },
      middlewares: { use },
    });

    expect(use).toHaveBeenCalledWith('/__toolbar', expect.any(Function));
    const transform = plugin.transformIndexHtml as (html: string) => string;
    const html = transform('<html><body><div id="root"></div></body></html>');
    expect(html).toContain(
      `<script type="module" id="${TOOLBAR_SCRIPT_ID}" ${ROUTE_ATTRIBUTE}="/__toolbar" src="/__toolbar/toolbar.js"></script></body>`,
    );
  });

  it('still honors the legacy /__camp route when pinned in an existing config', async () => {
    const root = await makeRoot({ port: 4242, integration: { route: '/__camp' } });
    const use = vi.fn();
    const plugin = paperCamp();
    await (plugin.configureServer as unknown as (server: FakeServer) => Promise<void>)({
      config: { root },
      middlewares: { use },
    });

    expect(use).toHaveBeenCalledWith('/__camp', expect.any(Function));
    const transform = plugin.transformIndexHtml as (html: string) => string;
    const html = transform('<html><body><div id="root"></div></body></html>');
    expect(html).toContain(
      `<script type="module" id="${TOOLBAR_SCRIPT_ID}" ${ROUTE_ATTRIBUTE}="/__camp" src="/__camp/toolbar.js"></script></body>`,
    );
  });

  it('stays enabled in production mode when integration.toolbar.allowProduction is true', async () => {
    const root = await makeRoot({
      port: 4242,
      integration: { toolbar: { allowProduction: true } },
    });
    const use = vi.fn();
    const plugin = paperCamp();
    await (plugin.configureServer as unknown as (server: FakeServer) => Promise<void>)({
      config: { root, mode: 'production' },
      middlewares: { use },
    });

    expect(use).toHaveBeenCalledWith(CAMP_ROUTE, expect.any(Function));
  });
});
