import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTE_ATTRIBUTE, TOOLBAR_SCRIPT_ID } from '../toolbar/route-attribute';
import { resolveDaemonTarget } from './daemon-target';
import { type PaperCampToolbarOptions, TOOLBAR_OFF_MESSAGE, paperCamp } from './index';

vi.mock('./daemon-target', () => ({ resolveDaemonTarget: vi.fn() }));

interface FakeServer {
  config: { root: string; mode?: string };
}

function configureServer(plugin: ReturnType<typeof paperCamp>, server: FakeServer): Promise<void> {
  return (plugin.configureServer as unknown as (server: FakeServer) => Promise<void>)(server);
}

function transformOf(plugin: ReturnType<typeof paperCamp>) {
  return plugin.transformIndexHtml as (html: string) => string | { html: string; tags: unknown[] };
}

const HTML = '<html><body><div id="root"></div></body></html>';

describe('paperCamp', () => {
  const dirs: string[] = [];
  const resolveDaemonTargetMock = vi.mocked(resolveDaemonTarget);

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  afterEach(() => {
    resolveDaemonTargetMock.mockReset();
    vi.restoreAllMocks();
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

  it('injects a script tag pointing straight at the daemon origin and slug mount', async () => {
    const root = await makeRoot({});
    resolveDaemonTargetMock.mockResolvedValue({ origin: 'http://localhost:4333', slug: 'demo' });
    const plugin = paperCamp();

    await configureServer(plugin, { config: { root } });

    expect(transformOf(plugin)(HTML)).toEqual({
      html: HTML,
      tags: [
        {
          tag: 'script',
          attrs: {
            type: 'module',
            id: TOOLBAR_SCRIPT_ID,
            [ROUTE_ATTRIBUTE]: '/p/demo',
            src: 'http://localhost:4333/p/demo/toolbar.js',
          },
          injectTo: 'body',
        },
      ],
    });
  });

  it('injects the tag even when the index has no </body>', async () => {
    const root = await makeRoot({});
    resolveDaemonTargetMock.mockResolvedValue({ origin: 'http://localhost:4333', slug: 'demo' });
    const plugin = paperCamp();
    const bodylessHtml = '<html><div id="root"></div></html>';

    await configureServer(plugin, { config: { root } });

    const result = transformOf(plugin)(bodylessHtml) as { html: string; tags: unknown[] };
    expect(result.html).toBe(bodylessHtml);
    expect(result.tags).toHaveLength(1);
  });

  it('passes the port option through to resolveDaemonTarget as the manual override', async () => {
    const root = await makeRoot({});
    resolveDaemonTargetMock.mockResolvedValue({ origin: 'http://localhost:9999', slug: 'demo' });
    const plugin = paperCamp({ port: 9999 });

    await configureServer(plugin, { config: { root } });

    expect(resolveDaemonTargetMock).toHaveBeenCalledWith(root, 9999);
  });

  it('prints the off notice and injects nothing when the daemon target cannot be resolved', async () => {
    const root = await makeRoot({});
    resolveDaemonTargetMock.mockResolvedValue(undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const plugin = paperCamp();

    await configureServer(plugin, { config: { root } });

    expect(log).toHaveBeenCalledWith(TOOLBAR_OFF_MESSAGE);
    expect(transformOf(plugin)(HTML)).toBe(HTML);
  });

  it('skips resolution and injects nothing when integration.toolbar.enabled is false', async () => {
    const root = await makeRoot({ integration: { toolbar: { enabled: false } } });
    const plugin = paperCamp();

    await configureServer(plugin, { config: { root } });

    expect(resolveDaemonTargetMock).not.toHaveBeenCalled();
    expect(transformOf(plugin)(HTML)).toBe(HTML);
  });

  it('skips resolution and injects nothing when mode is production', async () => {
    const root = await makeRoot({});
    const plugin = paperCamp();

    await configureServer(plugin, { config: { root, mode: 'production' } });

    expect(resolveDaemonTargetMock).not.toHaveBeenCalled();
    expect(transformOf(plugin)(HTML)).toBe(HTML);
  });

  it('resolves normally in production mode when integration.toolbar.allowProduction is true', async () => {
    const root = await makeRoot({ integration: { toolbar: { allowProduction: true } } });
    resolveDaemonTargetMock.mockResolvedValue({ origin: 'http://localhost:4333', slug: 'demo' });
    const plugin = paperCamp();

    await configureServer(plugin, { config: { root, mode: 'production' } });

    expect(resolveDaemonTargetMock).toHaveBeenCalledWith(root, undefined);
  });
});
