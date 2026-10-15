import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeToActivityStream } from './activity-stream';
import { setApiBase } from './api-base';
import { switchRuntime } from './runtime-connection';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  setApiBase('');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('subscribeToActivityStream', () => {
  it('opens one EventSource against the current api base and closes it on unsubscribe', () => {
    const unsubscribe = subscribeToActivityStream(() => {});
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]?.url).toBe('/api/activity/stream');

    unsubscribe();
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });
});

describe('switchRuntime', () => {
  it('redials the current-runtime stream against the new base, keeping the same listener', () => {
    const received: unknown[] = [];
    const unsubscribe = subscribeToActivityStream((payload) => received.push(payload));
    const first = FakeEventSource.instances[0];

    switchRuntime({ runtimeUrl: 'http://localhost:4444', pairingToken: null });

    expect(first?.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    const second = FakeEventSource.instances[1];
    expect(second?.url).toBe('http://localhost:4444/api/activity/stream');

    second?.onmessage?.({ data: JSON.stringify({ type: 'agent' }) } as MessageEvent<string>);
    expect(received).toEqual([{ type: 'agent' }]);

    unsubscribe();
  });

  it('is a no-op on the stream when nothing is subscribed', () => {
    switchRuntime({ runtimeUrl: 'http://localhost:5555', pairingToken: null });
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
