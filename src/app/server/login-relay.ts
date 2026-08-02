import * as pty from 'node-pty';

const URL_TIMEOUT_MS = 20_000;
const SESSION_TIMEOUT_MS = 5 * 60_000;
const KILL_GRACE_MS = 2000;

const ESC = String.fromCharCode(27);
const ANSI_ESCAPE_RE = new RegExp(
  `${ESC}[[\\]()#;?]*(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]`,
  'g',
);
const URL_RE = /https?:\/\/\S+/;

export type LoginRelayPhase =
  | 'starting'
  | 'awaiting-authorization'
  | 'success'
  | 'error'
  | 'cancelled';

export interface LoginRelayState {
  phase: LoginRelayPhase;
  authorizeUrl: string | null;
  error?: string;
}

export interface LoginRelayHandle {
  getState: () => LoginRelayState;
  cancel: () => void;
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, '');
}

function extractAuthorizeUrl(buffer: string): string | null {
  const match = stripAnsi(buffer).match(URL_RE);
  return match ? match[0] : null;
}

function killWithEscalation(proc: pty.IPty): void {
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
}

export function startClaudeLoginRelay(
  root: string,
  opts: LoginRelayOptions = {},
): LoginRelayHandle {
  if (current && !isDone(current.getState().phase)) return current;

  const state: LoginRelayState = { phase: 'starting', authorizeUrl: null };
  let buffer = '';

  const proc = pty.spawn('claude', ['auth', 'login'], {
    name: 'xterm-color',
    cols: 300,
    rows: 40,
    cwd: root,
    env: process.env as Record<string, string>,
  });

  const urlTimeout = setTimeout(() => {
    if (state.phase !== 'starting') return;
    state.phase = 'error';
    state.error = 'Timed out waiting for the sign-in link from `claude auth login`';
    killWithEscalation(proc);
  }, opts.urlTimeoutMs ?? URL_TIMEOUT_MS);

  const sessionTimeout = setTimeout(() => {
    if (isDone(state.phase)) return;
    state.phase = 'error';
    state.error = 'Sign-in was not completed in time';
    killWithEscalation(proc);
  }, opts.sessionTimeoutMs ?? SESSION_TIMEOUT_MS);

  proc.onData((chunk) => {
    if (state.phase !== 'starting') return;
    buffer += chunk;
    const url = extractAuthorizeUrl(buffer);
    if (url) {
      clearTimeout(urlTimeout);
      state.phase = 'awaiting-authorization';
      state.authorizeUrl = url;
    }
  });

  proc.onExit(({ exitCode }) => {
    clearTimeout(urlTimeout);
    clearTimeout(sessionTimeout);
    if (isDone(state.phase)) return;
    if (exitCode === 0 && state.phase === 'awaiting-authorization') {
      state.phase = 'success';
    } else {
      state.phase = 'error';
      state.error = state.error ?? 'claude auth login exited before signing in';
    }
  });

  const handle: LoginRelayHandle = {
    getState: () => ({ ...state }),
    cancel: () => {
      if (isDone(state.phase)) return;
      clearTimeout(urlTimeout);
      clearTimeout(sessionTimeout);
      state.phase = 'cancelled';
      killWithEscalation(proc);
    },
  };
  current = handle;
  return handle;
}

function isDone(phase: LoginRelayPhase): boolean {
  return phase === 'success' || phase === 'error' || phase === 'cancelled';
}

export function getCurrentLoginRelay(): LoginRelayHandle | null {
  return current;
}
