import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { MOUNT_ATTRIBUTE, readMountPrefix } from '../app/services/mount';
import { injectMountAttribute, proxyToCampServer } from './proxy';

const SPA_FALLBACK = '<!DOCTYPE html><html><body><div id="root"></div></body></html>';

function htmlServer(servers: Server[]): Promise<number> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(SPA_FALLBACK);
  });
  servers.push(server);
  return listen(server);
}

function rootMount(html: string): string {
  const match = html.match(new RegExp(`<div id="root"(?: ${MOUNT_ATTRIBUTE}="([^"]*)")?>`));
  return readMountPrefix({ getAttribute: () => match?.[1] ?? null });
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('proxyToCampServer', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(close));
  });

  it('forwards the request path, method, and body to the target port', async () => {
    const target = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        res.writeHead(200, { 'x-seen-path': req.url ?? '', 'content-type': 'text/plain' });
        res.end(`${req.method} ${body}`);
      });
    });
    servers.push(target);
    const targetPort = await listen(target);

    const proxy = createServer((req, res) => proxyToCampServer(req, res, { port: targetPort }));
    servers.push(proxy);
    const proxyPort = await listen(proxy);

    const response = await fetch(`http://127.0.0.1:${proxyPort}/status`, {
      method: 'POST',
      body: 'hello',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-seen-path')).toBe('/status');
    expect(await response.text()).toBe('POST hello');
  });

  it('responds 502 when the target port has nothing listening', async () => {
    const proxy = createServer((req, res) => proxyToCampServer(req, res, { port: 1 }));
    servers.push(proxy);
    const proxyPort = await listen(proxy);

    const response = await fetch(`http://127.0.0.1:${proxyPort}/status`);

    expect(response.status).toBe(502);
  });

  it('injects the mount into the SPA fallback so a deep-link reload reads it, not the URL', async () => {
    const targetPort = await htmlServer(servers);
    const proxy = createServer((req, res) =>
      proxyToCampServer(req, res, { port: targetPort, mount: '/paper-camp' }),
    );
    servers.push(proxy);
    const proxyPort = await listen(proxy);

    const response = await fetch(`http://127.0.0.1:${proxyPort}/plans/some-deep-title`);
    const html = await response.text();

    expect(html).toContain(`<div id="root" ${MOUNT_ATTRIBUTE}="/paper-camp">`);
    expect(rootMount(html)).toBe('/paper-camp');
  });

  it('forces identity encoding so a compressing upstream still yields injectable HTML', async () => {
    const target = createServer((req, res) => {
      if ((req.headers['accept-encoding'] ?? '').includes('gzip')) {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-encoding': 'gzip',
        });
        res.end(gzipSync(Buffer.from(SPA_FALLBACK)));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(SPA_FALLBACK);
    });
    servers.push(target);
    const targetPort = await listen(target);

    const proxy = createServer((req, res) =>
      proxyToCampServer(req, res, { port: targetPort, mount: '/paper-camp' }),
    );
    servers.push(proxy);
    const proxyPort = await listen(proxy);

    const response = await fetch(`http://127.0.0.1:${proxyPort}/plans/some-deep-title`);
    const html = await response.text();

    expect(html).toContain(`<div id="root" ${MOUNT_ATTRIBUTE}="/paper-camp">`);
    expect(rootMount(html)).toBe('/paper-camp');
  });

  it('leaves the SPA fallback untouched when serving standalone (no mount)', async () => {
    const targetPort = await htmlServer(servers);
    const proxy = createServer((req, res) => proxyToCampServer(req, res, { port: targetPort }));
    servers.push(proxy);
    const proxyPort = await listen(proxy);

    const response = await fetch(`http://127.0.0.1:${proxyPort}/plans/some-deep-title`);
    const html = await response.text();

    expect(html).toBe(SPA_FALLBACK);
    expect(rootMount(html)).toBe('');
  });

  it('does not rewrite non-HTML responses even under a mount', async () => {
    const target = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"branch":"main"}');
    });
    servers.push(target);
    const targetPort = await listen(target);

    const proxy = createServer((req, res) =>
      proxyToCampServer(req, res, { port: targetPort, mount: '/paper-camp' }),
    );
    servers.push(proxy);
    const proxyPort = await listen(proxy);

    const response = await fetch(`http://127.0.0.1:${proxyPort}/api/status`);

    expect(await response.text()).toBe('{"branch":"main"}');
  });
});

describe('injectMountAttribute', () => {
  it('marks the root element with the serving mount', () => {
    expect(injectMountAttribute('<div id="root"></div>', '/paper-camp')).toBe(
      `<div id="root" ${MOUNT_ATTRIBUTE}="/paper-camp"></div>`,
    );
  });
});
