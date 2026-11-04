import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAgentSignIn,
  isAuthFailure,
  markAgentSignedIn,
  markAgentSignedOut,
  onAgentSignInChange,
  onAgentSignedIn,
  resetAgentSignInForTests,
} from './agent-signin';

beforeEach(() => resetAgentSignInForTests());

describe('isAuthFailure', () => {
  it.each([
    'Failed to authenticate: OAuth session expired and could not be refreshed',
    'phase 1 — Failed to authenticate: OAuth session expired and could not be refreshed',
    'OAuth token has expired',
    'Invalid API key · Please run /login',
    '{"type":"error","error":{"type":"authentication_error"}}',
    'API Error: 401 Unauthorized',
  ])('recognises %s', (text) => {
    expect(isAuthFailure(text)).toBe(true);
  });

  it.each([
    undefined,
    'node exited with code 1',
    'Tests failed: oauthCallback returns 302',
    'phase 2 — no progress for 30min',
  ])('ignores %s', (text) => {
    expect(isAuthFailure(text)).toBe(false);
  });
});

describe('sign-in state', () => {
  it('reports a transition to signed out once', () => {
    const onChange = vi.fn();
    onAgentSignInChange(onChange);

    expect(markAgentSignedOut('session expired')).toBe(true);
    expect(markAgentSignedOut('session still expired')).toBe(false);

    expect(getAgentSignIn()).toMatchObject({ signedOut: true, reason: 'session still expired' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('scopes the sign-out to claude-code', () => {
    markAgentSignedOut('session expired');
    expect(getAgentSignIn('opencode').signedOut).toBe(false);
  });

  it('clears the state and wakes sign-in listeners', () => {
    const onChange = vi.fn();
    const onSignedIn = vi.fn();
    markAgentSignedOut('session expired');
    onAgentSignInChange(onChange);
    onAgentSignedIn(onSignedIn);

    markAgentSignedIn();

    expect(getAgentSignIn().signedOut).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('wakes sign-in listeners even when no sign-out was recorded', () => {
    const onChange = vi.fn();
    const onSignedIn = vi.fn();
    onAgentSignInChange(onChange);
    onAgentSignedIn(onSignedIn);

    markAgentSignedIn();

    expect(onChange).not.toHaveBeenCalled();
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });
});
