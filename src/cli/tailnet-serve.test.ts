import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TAILNET_HTTPS_CERTS_ADMIN_LINK,
  TAILNET_OPERATOR_MESSAGE,
  TAILNET_SERVE_NOT_ENABLED_MESSAGE,
  isMissingHttpsCertsError,
  runTailnetServe,
  tailnetFailureMessage,
  tailnetServeArgs,
} from './tailnet-serve';

describe('tailnetServeArgs', () => {
  it('backgrounds an https:443 serve config proxied at the dev server port', () => {
    expect(tailnetServeArgs(3333)).toEqual([
      'serve',
      '--bg',
      '--https=443',
      'http://localhost:3333',
    ]);
  });
});

describe('isMissingHttpsCertsError', () => {
  it('matches the HTTPS cert-support error tailscale reports', () => {
    expect(
      isMissingHttpsCertsError('HTTPS cert support is not enabled/configured for your tailnet.'),
    ).toBe(true);
  });

  it('matches the TLS cert-support error tailscale reports', () => {
    expect(
      isMissingHttpsCertsError(
        'TLS certificate support is not enabled/configured for your tailnet.',
      ),
    ).toBe(true);
  });

  it('does not match unrelated failure output', () => {
    expect(isMissingHttpsCertsError('bind: address already in use')).toBe(false);
  });
});

describe('tailscale binary stubbing', () => {
  const dirs: string[] = [];
  const originalPath = process.env.PATH;

  afterEach(async () => {
    process.env.PATH = originalPath;
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs.length = 0;
  });

  async function stubTailscale(script: string): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-tailscale-'));
    dirs.push(dir);
    const binPath = join(dir, 'tailscale');
    await writeFile(binPath, `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    process.env.PATH = `${dir}:${originalPath}`;
  }

  describe('runTailnetServe', () => {
    it('resolves ok when the command exits 0', async () => {
      await stubTailscale('exit 0');
      const result = await runTailnetServe(3333);
      expect(result).toEqual({ ok: true, output: '' });
    });

    it('resolves not-ok with the combined output when the command fails', async () => {
      await stubTailscale(
        'echo "HTTPS cert support is not enabled/configured for your tailnet." >&2\nexit 1',
      );
      const result = await runTailnetServe(3333);
      expect(result.ok).toBe(false);
      expect(isMissingHttpsCertsError(result.output)).toBe(true);
      expect(TAILNET_HTTPS_CERTS_ADMIN_LINK).toBe('https://login.tailscale.com/admin/dns');
    });

    it('resolves not-ok when the tailscale binary is missing', async () => {
      process.env.PATH = '';
      const result = await runTailnetServe(3333);
      expect(result.ok).toBe(false);
    });
  });
});

describe('tailnetFailureMessage', () => {
  it('names the certificate remedy for a missing-certs failure', () => {
    const message = tailnetFailureMessage(
      'HTTPS cert support is not enabled/configured for your tailnet.',
    );
    expect(message).toMatch(/^papercamp: Tailnet failed — /);
    expect(message).toContain('HTTPS Certificates');
  });

  it('names the Serve enable remedy and keeps the link the CLI printed', () => {
    const output =
      'Serve is not enabled on your tailnet.\nTo enable, visit:\n\thttps://login.tailscale.com/f/serve?node=abc';
    const message = tailnetFailureMessage(output);
    expect(message).toContain(TAILNET_SERVE_NOT_ENABLED_MESSAGE);
    expect(message).toContain('https://login.tailscale.com/f/serve?node=abc');
  });

  it('names the operator grant when the user may not configure tailscale', () => {
    expect(tailnetFailureMessage('Access denied: serve config denied')).toContain(
      TAILNET_OPERATOR_MESSAGE,
    );
  });
});
