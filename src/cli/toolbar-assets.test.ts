import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { serveToolbarAsset } from './toolbar-assets';

const dirs: string[] = [];
const servers: Server[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
});

async function makeToolbarDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'paper-camp-toolbar-'));
  dirs.push(dir);
  return dir;
}

async function listen(dir: string): Promise<number> {
  const server = createServer((req, res) => {
    serveToolbarAsset(req, res, dir)
      .then((served) => {
        if (!served) {
          res.statusCode = 404;
          res.end();
        }
      })
      .catch((error) => {
        res.statusCode = 500;
        res.end(String(error));
      });
  });
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

describe('serveToolbarAsset', () => {
  it('serves toolbar.js as JavaScript', async () => {
    const dir = await makeToolbarDir();
    await writeFile(join(dir, 'toolbar.js'), 'console.log(1)', 'utf-8');
    const port = await listen(dir);

    const response = await fetch(`http://127.0.0.1:${port}/toolbar.js`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await response.text()).toBe('console.log(1)');
  });

  it('serves toolbar.js.map', async () => {
    const dir = await makeToolbarDir();
    await writeFile(join(dir, 'toolbar.js.map'), '{"version":3}', 'utf-8');
    const port = await listen(dir);

    const response = await fetch(`http://127.0.0.1:${port}/toolbar.js.map`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await response.text()).toBe('{"version":3}');
  });

  it('falls through for any other path', async () => {
    const dir = await makeToolbarDir();
    await writeFile(join(dir, 'toolbar.js'), 'console.log(1)', 'utf-8');
    const port = await listen(dir);

    const response = await fetch(`http://127.0.0.1:${port}/api/status`);

    expect(response.status).toBe(404);
  });

  it('falls through when the asset is not built', async () => {
    const dir = await makeToolbarDir();
    const port = await listen(dir);

    const response = await fetch(`http://127.0.0.1:${port}/toolbar.js`);

    expect(response.status).toBe(404);
  });
});
