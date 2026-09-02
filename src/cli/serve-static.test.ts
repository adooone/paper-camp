import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { serveStatic } from './serve-static';

const FALLBACK_HTML = '<!DOCTYPE html><html><body><div id="root"></div></body></html>';

const dirs: string[] = [];
const servers: Server[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
});

async function makeStaticDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'paper-camp-static-'));
  dirs.push(dir);
  return dir;
}

async function listen(staticDir: string, fallbackHtml: string): Promise<number> {
  const server = createServer((req, res) => {
    serveStatic(req, res, staticDir, fallbackHtml).catch((error) => {
      res.statusCode = 500;
      res.end(String(error));
    });
  });
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

describe('serveStatic', () => {
  it('serves a real file on disk with its MIME type', async () => {
    const dir = await makeStaticDir();
    await writeFile(join(dir, 'app.js'), 'console.log(1)', 'utf-8');
    const port = await listen(dir, FALLBACK_HTML);

    const response = await fetch(`http://127.0.0.1:${port}/app.js`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await response.text()).toBe('console.log(1)');
  });

  it('falls back to the given HTML for an unknown path (client-side route)', async () => {
    const dir = await makeStaticDir();
    const port = await listen(dir, FALLBACK_HTML);

    const response = await fetch(`http://127.0.0.1:${port}/plans/some-deep-title`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await response.text()).toBe(FALLBACK_HTML);
  });

  it('serves the fallback HTML for `/` without reading index.html from disk', async () => {
    const dir = await makeStaticDir();
    await writeFile(join(dir, 'index.html'), 'stale on-disk copy', 'utf-8');
    const port = await listen(dir, FALLBACK_HTML);

    const response = await fetch(`http://127.0.0.1:${port}/`);

    expect(await response.text()).toBe(FALLBACK_HTML);
  });

  it('serves nested real files', async () => {
    const dir = await makeStaticDir();
    await mkdir(join(dir, 'assets'), { recursive: true });
    await writeFile(join(dir, 'assets', 'style.css'), 'body{}', 'utf-8');
    const port = await listen(dir, FALLBACK_HTML);

    const response = await fetch(`http://127.0.0.1:${port}/assets/style.css`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('body{}');
  });

  it('treats a path-traversal attempt as the SPA fallback rather than escaping staticDir', async () => {
    const dir = await makeStaticDir();
    const outside = await makeStaticDir();
    await writeFile(join(outside, 'secret.txt'), 'top secret', 'utf-8');
    const port = await listen(dir, FALLBACK_HTML);

    const escapePath = `/${relative(dir, join(outside, 'secret.txt'))}`;
    const response = await fetch(`http://127.0.0.1:${port}${escapePath}`);
    const body = await response.text();

    expect(body).not.toContain('top secret');
    expect(body).toBe(FALLBACK_HTML);
  });
});
