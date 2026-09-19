import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MACHINE_NIGHT_PATH } from '@/types/index';
import { afterEach, describe, expect, it } from 'vitest';
import { fetchMachineNightGate } from './capabilities-api';

describe('fetchMachineNightGate', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
  });

  async function listenOnFreePort(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Promise<string> {
    const server = createServer(handler);
    servers.push(server);
    return new Promise((resolve) => {
      server.listen(0, () => resolve(`http://localhost:${(server.address() as AddressInfo).port}`));
    });
  }

  it('resolves the gate response the endpoint answers with', async () => {
    const body = {
      slug: 'demo',
      projectMissing: false,
      gate: {
        open: false,
        reasons: ['task-running'],
        fiveHourUtilizationPct: 10,
        sevenDayUtilizationPct: 20,
      },
    };
    const machineUrl = await listenOnFreePort((req, res) => {
      if (req.url === MACHINE_NIGHT_PATH) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    expect(await fetchMachineNightGate(machineUrl)).toEqual(body);
  });

  it('resolves null when the endpoint answers with a non-2xx status', async () => {
    const machineUrl = await listenOnFreePort((_req, res) => {
      res.statusCode = 500;
      res.end();
    });

    expect(await fetchMachineNightGate(machineUrl)).toBeNull();
  });

  it('resolves null when the machine is unreachable', async () => {
    const machineUrl = await listenOnFreePort((_req, res) => res.end());
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));

    expect(await fetchMachineNightGate(machineUrl)).toBeNull();
  });
});
