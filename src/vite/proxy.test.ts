import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { proxyToCampServer } from './proxy';

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
});
