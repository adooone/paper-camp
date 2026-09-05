import type * as Pty from 'node-pty';
import type { LoginRelayPhase, LoginRelayState } from '../../types';
import { claudeAuthStatus } from './local-adapters';

const URL_TIMEOUT_MS = 20_000;
const SESSION_TIMEOUT_MS = 5 * 60_000;
const KILL_GRACE_MS = 2000;
const AUTH_STATUS_POLL_MS = 2000;
const AUTH_STATUS_POLL_TIMEOUT_MS = 30_000;

const ESC = String.fromCharCode(27);
const ANSI_ESCAPE_RE = new RegExp(
  `${ESC}[[\\]()#;?]*(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]`,
  'g',
);
// OSC 8 hyperlinks (2.1.250 wraps the sign-in link in one): `ESC ]` payload terminated
// by BEL or `ESC \` — a different shape than the CSI sequences above, and the CSI
// regex's char class partially matches its introducer, mangling the URL if this doesn't run first.
const OSC_ESCAPE_RE = new RegExp(`${ESC}\\][^\\x07${ESC}]*(?:\\x07|${ESC}\\\\)`, 'g');
const URL_RE = /https?:\/\/\S+/;
const PASTE_CODE_MARKER = 'Paste code here';

export type { LoginRelayPhase, LoginRelayState };

export interface LoginRelayHandle {
  getState: () => LoginRelayState;
  cancel: () => void;
  submitCode: (code: string) => void;
}

function stripAnsi(text: string): string {
  return text.replace(OSC_ESCAPE_RE, '').replace(ANSI_ESCAPE_RE, '');
}

function extractAuthorizeUrl(buffer: string): string | null {
  const match = stripAnsi(buffer).match(URL_RE);
  return match ? match[0] : null;
}

function killWithEscalation(proc: Pty.IPty): void {
  let exited = false;
  proc.onExit(() => {
    exited = true;
  });
  proc.kill();
  setTimeout(() => {
    if (!exited) proc.kill('SIGKILL');
  }, KILL_GRACE_MS);
}

// Only one `claude auth login` may run at a time — a second attempt while one is
// pending would spawn a competing browser callback the CLI can't disambiguate.
let current: LoginRelayHandle | null = null;

export interface LoginRelayOptions {
  urlTimeoutMs?: number;
  sessionTimeoutMs?: number;
  authStatusPollMs?: number;
  authStatusPollTimeoutMs?: number;
  /** Fires once `claude auth status` confirms `loggedIn: true` after the CLI exits —
   * the caller's cue to clear the signed-out state and resume whatever run parked on it. */
  onLoginConfirmed?: () => void;
}

// The CLI exiting 0 already implies success, but its auth state can lag the exit by a
// beat, so confirm against the same probe that flagged "signed out" in the first place.
function pollAuthStatus(root: string, opts: LoginRelayOptions): void {
  if (!opts.onLoginConfirmed) return;
  const pollMs = opts.authStatusPollMs ?? AUTH_STATUS_POLL_MS;
  const deadline = Date.now() + (opts.authStatusPollTimeoutMs ?? AUTH_STATUS_POLL_TIMEOUT_MS);
  const tick = async () => {
    const status = await claudeAuthStatus(root);
    if (status?.loggedIn) {
      opts.onLoginConfirmed?.();
      return;
    }
    if (Date.now() >= deadline) return;
    setTimeout(tick, pollMs);
  };
  void tick();
}

export async function startClaudeLoginRelay(
  root: string,
  opts: LoginRelayOptions = {},
): Promise<LoginRelayHandle> {
  if (current && !isDone(current.getState().phase)) return current;

  const state: LoginRelayState = { phase: 'starting', authorizeUrl: null };
  let buffer = '';
  let proc: Pty.IPty | undefined;
  let cancelledBeforeSpawn = false;
  let codeSubmitted = false;

  // Reserved synchronously (before the `await import` below yields) so a second call
  // racing in during module load sees `current` and returns this handle instead of spawning a competing login.
  const handle: LoginRelayHandle = {
    getState: () => ({ ...state }),
    cancel: () => {
      if (isDone(state.phase)) return;
      state.phase = 'cancelled';
      if (proc) killWithEscalation(proc);
      else cancelledBeforeSpawn = true;
    },
    submitCode: () => {},
  };
  current = handle;

  // Loaded lazily so requiring this module (pulled in by every `dev` route) doesn't
  // touch node-pty's native binding — only actually starting a login relay does.
  let pty: typeof import('node-pty');
  try {
    pty = await import('node-pty');
  } catch (err) {
    state.phase = 'error';
    state.error = `The sign-in relay isn't available in this environment: ${(err as Error).message}`;
    return handle;
  }

  if (cancelledBeforeSpawn) return handle;

  // A no-PTY sandbox or missing `claude` binary makes pty.spawn throw synchronously; surface
  // that as the same 'error' phase so the client falls back to the copy-command guide.
  try {
    proc = pty.spawn('claude', ['auth', 'login'], {
      name: 'xterm-color',
      cols: 300,
      rows: 40,
      cwd: root,
      env: process.env as Record<string, string>,
    });
  } catch (err) {
    state.phase = 'error';
    state.error = `The sign-in relay isn't available in this environment: ${(err as Error).message}`;
    return handle;
  }

  const urlTimeout = setTimeout(() => {
    if (state.phase !== 'starting') return;
    state.phase = 'error';
    state.error = 'Timed out waiting for the sign-in link from `claude auth login`';
    if (proc) killWithEscalation(proc);
  }, opts.urlTimeoutMs ?? URL_TIMEOUT_MS);

  const sessionTimeout = setTimeout(() => {
    if (isDone(state.phase)) return;
    state.phase = 'error';
    state.error = 'Sign-in was not completed in time';
    if (proc) killWithEscalation(proc);
  }, opts.sessionTimeoutMs ?? SESSION_TIMEOUT_MS);

  proc.onData((chunk) => {
    if (isDone(state.phase)) return;
    buffer += chunk;
    if (state.phase === 'starting') {
      const url = extractAuthorizeUrl(buffer);
      if (url) {
        clearTimeout(urlTimeout);
        state.phase = 'awaiting-authorization';
        state.authorizeUrl = url;
      }
    }
    // The CLI falls back to this prompt when its localhost callback can't complete
    // (e.g. a headless remote box) — otherwise exit 0 alone means success below.
    if (!codeSubmitted && !state.needsCode && stripAnsi(buffer).includes(PASTE_CODE_MARKER)) {
      state.needsCode = true;
    }
  });

  proc.onExit(({ exitCode }) => {
    clearTimeout(urlTimeout);
    clearTimeout(sessionTimeout);
    if (isDone(state.phase)) return;
    if (exitCode === 0 && state.phase === 'awaiting-authorization') {
      state.phase = 'success';
      pollAuthStatus(root, opts);
    } else {
      state.phase = 'error';
      state.error = state.error ?? 'claude auth login exited before signing in';
    }
  });

  handle.cancel = () => {
    if (isDone(state.phase)) return;
    clearTimeout(urlTimeout);
    clearTimeout(sessionTimeout);
    state.phase = 'cancelled';
    if (proc) killWithEscalation(proc);
  };

  handle.submitCode = (code: string) => {
    if (isDone(state.phase) || !proc) return;
    codeSubmitted = true;
    state.needsCode = false;
    proc.write(`${code}\r`);
  };

  return handle;
}

function isDone(phase: LoginRelayPhase): boolean {
  return phase === 'success' || phase === 'error' || phase === 'cancelled';
}

export function getCurrentLoginRelay(): LoginRelayHandle | null {
  return current;
}
