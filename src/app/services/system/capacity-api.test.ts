import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { setApiBase } from '../api-base';
import { fetchCapacity, probeCapacity } from './capacity-api';

describe('capacity-api', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
    setApiBase('');
  });

  async function listenOnFreePort(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Promise<void> {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        setApiBase(`http://localhost:${(server.address() as AddressInfo).port}`);
        resolve();
      });
    });
  }

  describe('fetchCapacity', () => {
    it('resolves the stored record', async () => {
      const record = { snapshot: { status: 'allowed' }, capturedAt: 'now', source: 'probe' };
      await listenOnFreePort((_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(record));
      });
      expect(await fetchCapacity()).toEqual(record);
    });

    it('resolves null on a non-2xx status', async () => {
      await listenOnFreePort((_req, res) => {
        res.statusCode = 500;
        res.end();
      });
      expect(await fetchCapacity()).toBeNull();
    });
  });

  describe('probeCapacity', () => {
    it('resolves on a successful probe', async () => {
      await listenOnFreePort((_req, res) => res.end('{}'));
      await expect(probeCapacity()).resolves.toBeUndefined();
    });

    it('throws with the route error on a failed probe', async () => {
      await listenOnFreePort((_req, res) => {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Claude reported no capacity — is the CLI signed in?' }));
      });
      await expect(probeCapacity()).rejects.toThrow('Claude reported no capacity');
    });
  });
});
