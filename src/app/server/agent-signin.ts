import type { AgentId } from '@/types/index';

export const SIGNED_OUT_ERROR = 'Claude needs you to sign in again';

export interface AgentSignInState {
  signedOut: boolean;
  reason?: string;
  since?: string;
}

// `claude auth status` keeps reporting `loggedIn: true` for an OAuth session that has
// expired and can no longer refresh, so the CLI's own failure text is the signal.
const AUTH_FAILURE_PATTERNS = [
  /failed to authenticate/i,
  /oauth (session|token) (has )?expired/i,
  /invalid api key/i,
  /please run \/login/i,
  /authentication_error/i,
  /\b401\b[^\n]*unauthori[sz]ed/i,
];

export function isAuthFailure(text: string | undefined): boolean {
  return text !== undefined && AUTH_FAILURE_PATTERNS.some((pattern) => pattern.test(text));
}

// Module-level on purpose: the daemon serves every project from one process, and a
// Claude sign-in belongs to the machine, not to any one project.
let state: AgentSignInState = { signedOut: false };
const changeListeners = new Set<(state: AgentSignInState) => void>();
const signedInListeners = new Set<() => void>();

export function getAgentSignIn(agentId: AgentId = 'claude-code'): AgentSignInState {
  return agentId === 'claude-code' ? state : { signedOut: false };
}

/** Returns true only on the transition, so the caller notifies once per sign-out. */
export function markAgentSignedOut(reason: string): boolean {
  if (state.signedOut) {
    state = { ...state, reason };
    return false;
  }
  state = { signedOut: true, reason, since: new Date().toISOString() };
  for (const listener of changeListeners) listener(state);
  return true;
}

/** Notifies every sign-in listener even when no sign-out was recorded: a run parked on
 * `auth status` reporting signed-out still needs resuming after a fresh login. */
export function markAgentSignedIn(): void {
  const wasSignedOut = state.signedOut;
  state = { signedOut: false };
  if (wasSignedOut) for (const listener of changeListeners) listener(state);
  for (const listener of signedInListeners) listener();
}

export function onAgentSignInChange(listener: (state: AgentSignInState) => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function onAgentSignedIn(listener: () => void): () => void {
  signedInListeners.add(listener);
  return () => signedInListeners.delete(listener);
}

export function resetAgentSignInForTests(): void {
  state = { signedOut: false };
  changeListeners.clear();
  signedInListeners.clear();
}
