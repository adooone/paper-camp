import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type LoginRelayHandle, getCurrentLoginRelay, startClaudeLoginRelay } from './login-relay';

const originalPath = process.env.PATH;
const dirs: string[] = [];

/** Prepends a fake `claude` executable running `script` onto PATH. */
function installClaude(script: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-login-relay-bin-'));
  writeFileSync(join(dir, 'claude'), `#!/bin/sh\n${script}\n`);
  chmodSync(join(dir, 'claude'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
  dirs.push(dir);
}

function waitFor(
  handle: LoginRelayHandle,
  predicate: (state: ReturnType<LoginRelayHandle['getState']>) => boolean,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate(handle.getState())) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('timed out waiting for state'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

afterEach(async () => {
  process.env.PATH = originalPath;
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('startClaudeLoginRelay', () => {
  it('parses the authorize URL out of interactive PTY output', async () => {
    installClaude(
      "echo 'Opening browser to sign in...'; echo 'If the browser did not open, visit: https://claude.com/cai/oauth/authorize?code=true&state=abc'; sleep 5",
    );
    const handle = startClaudeLoginRelay(process.cwd());
    await waitFor(handle, (s) => s.phase === 'awaiting-authorization');
    expect(handle.getState().authorizeUrl).toBe(
      'https://claude.com/cai/oauth/authorize?code=true&state=abc',
    );
    handle.cancel();
    await waitFor(handle, (s) => s.phase === 'cancelled');
  });

  it('transitions to success once the CLI exits 0 after the URL was found', async () => {
    installClaude(
      "echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 0.1; exit 0",
    );
    const handle = startClaudeLoginRelay(process.cwd());
    await waitFor(handle, (s) => s.phase === 'success');
  });

  it('reports error when the CLI exits non-zero before printing a URL', async () => {
    installClaude("echo 'not logged in' >&2; exit 1");
    const handle = startClaudeLoginRelay(process.cwd());
    await waitFor(handle, (s) => s.phase === 'error');
    expect(handle.getState().authorizeUrl).toBeNull();
  });

  it('times out waiting for the URL and kills the process', async () => {
    installClaude('sleep 5');
    const handle = startClaudeLoginRelay(process.cwd(), { urlTimeoutMs: 100 });
    await waitFor(handle, (s) => s.phase === 'error');
    expect(handle.getState().error).toMatch(/timed out/i);
  });

  it('times out an authorization that is never completed', async () => {
    installClaude("echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 5");
    const handle = startClaudeLoginRelay(process.cwd(), { sessionTimeoutMs: 200 });
    await waitFor(handle, (s) => s.phase === 'error');
    expect(handle.getState().error).toMatch(/not completed in time/i);
  });

  it('cancel() kills a pending login and marks it cancelled', async () => {
    installClaude("echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 5");
    const handle = startClaudeLoginRelay(process.cwd());
    await waitFor(handle, (s) => s.phase === 'awaiting-authorization');
    handle.cancel();
    expect(handle.getState().phase).toBe('cancelled');
  });

  it('returns the same handle for a second call while one is still pending', async () => {
    installClaude("echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 5");
    const first = startClaudeLoginRelay(process.cwd());
    const second = startClaudeLoginRelay(process.cwd());
    expect(second).toBe(first);
    expect(getCurrentLoginRelay()).toBe(first);
    first.cancel();
    await waitFor(first, (s) => s.phase === 'cancelled');
  });

  it('polls `claude auth status` after exit and fires onLoginConfirmed once it reports loggedIn', async () => {
    installClaude(
      `if [ "$1" = "auth" ] && [ "$2" = "login" ]; then
         echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 0.1; exit 0
       elif [ "$1" = "auth" ] && [ "$2" = "status" ]; then
         echo '{"loggedIn": true, "authMethod": "oauth", "apiProvider": null}'; exit 0
       fi`,
    );
    const onLoginConfirmed = vi.fn();
    const handle = startClaudeLoginRelay(process.cwd(), {
      authStatusPollMs: 20,
      onLoginConfirmed,
    });
    await waitFor(handle, (s) => s.phase === 'success');
    await vi.waitFor(() => expect(onLoginConfirmed).toHaveBeenCalledOnce());
  });

  it('gives up polling after the timeout without calling onLoginConfirmed', async () => {
    installClaude(
      `if [ "$1" = "auth" ] && [ "$2" = "login" ]; then
         echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 0.1; exit 0
       elif [ "$1" = "auth" ] && [ "$2" = "status" ]; then
         echo '{"loggedIn": false, "authMethod": null, "apiProvider": null}'; exit 0
       fi`,
    );
    const onLoginConfirmed = vi.fn();
    const handle = startClaudeLoginRelay(process.cwd(), {
      authStatusPollMs: 20,
      authStatusPollTimeoutMs: 60,
      onLoginConfirmed,
    });
    await waitFor(handle, (s) => s.phase === 'success');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(onLoginConfirmed).not.toHaveBeenCalled();
  });

  it('starts a fresh relay once the previous one finished', async () => {
    installClaude("echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 5");
    const first = startClaudeLoginRelay(process.cwd());
    await waitFor(first, (s) => s.phase === 'awaiting-authorization');
    first.cancel();
    await waitFor(first, (s) => s.phase === 'cancelled');

    const second = startClaudeLoginRelay(process.cwd());
    expect(second).not.toBe(first);
    second.cancel();
    await waitFor(second, (s) => s.phase === 'cancelled');
  });
});
