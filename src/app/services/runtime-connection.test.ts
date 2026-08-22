import { describe, expect, it } from 'vitest';
import {
  listRuntimes,
  loadRuntimeConnection,
  readRuntimeConnection,
  removeRuntime,
  renameRuntime,
  selectRuntime,
} from './runtime-connection';

function createStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe('readRuntimeConnection', () => {
  it('is empty when paper-camp dev serves this same bundle locally', () => {
    expect(readRuntimeConnection({ search: '' })).toEqual({
      runtimeUrl: '',
      pairingToken: null,
    });
  });

  it('is empty when there is no location at all', () => {
    expect(readRuntimeConnection(null)).toEqual({ runtimeUrl: '', pairingToken: null });
  });

  it('reads a detached runtime URL with no pairing token', () => {
    expect(readRuntimeConnection({ search: '?runtime=http%3A%2F%2Flocalhost%3A3333' })).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: null,
    });
  });

  it('reads a detached runtime URL alongside its pairing token', () => {
    expect(
      readRuntimeConnection({
        search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123',
      }),
    ).toEqual({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc123' });
  });
});

describe('loadRuntimeConnection', () => {
  it('is empty with no query string and no persisted connection', () => {
    expect(loadRuntimeConnection({ search: '' }, createStorage())).toEqual({
      runtimeUrl: '',
      pairingToken: null,
    });
  });

  it('persists a runtime carried in the query string', () => {
    const storage = createStorage();
    const connection = loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    expect(connection).toEqual({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc123' });
    expect(loadRuntimeConnection({ search: '' }, storage)).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc123',
    });
  });

  it('falls back to the active persisted connection when the query string is empty', () => {
    const storage = createStorage();
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    expect(loadRuntimeConnection({ search: '' }, storage)).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc123',
    });
  });

  it('overwrites a known runtime when a fresh link for it carries no token', () => {
    const storage = createStorage();
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    const connection = loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333' },
      storage,
    );
    expect(connection).toEqual({ runtimeUrl: 'http://localhost:3333', pairingToken: null });
    expect(listRuntimes(storage)).toEqual([
      { runtimeUrl: 'http://localhost:3333', pairingToken: null },
    ]);
  });

  it('works without a storage backend', () => {
    expect(
      loadRuntimeConnection({ search: '?runtime=http%3A%2F%2Flocalhost%3A3333' }, null),
    ).toEqual({ runtimeUrl: 'http://localhost:3333', pairingToken: null });
    expect(loadRuntimeConnection({ search: '' }, null)).toEqual({
      runtimeUrl: '',
      pairingToken: null,
    });
  });

  it('keeps every runtime a device has dialled rather than the last one only', () => {
    const storage = createStorage();
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A4444&token=def456' },
      storage,
    );
    expect(listRuntimes(storage)).toEqual([
      { runtimeUrl: 'http://localhost:3333', pairingToken: 'abc123' },
      { runtimeUrl: 'http://localhost:4444', pairingToken: 'def456' },
    ]);
    expect(loadRuntimeConnection({ search: '' }, storage)).toEqual({
      runtimeUrl: 'http://localhost:4444',
      pairingToken: 'def456',
    });
  });
});

describe('selectRuntime', () => {
  it('switches which known runtime is active', () => {
    const storage = createStorage();
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A4444&token=def456' },
      storage,
    );
    expect(selectRuntime('http://localhost:3333', storage)).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc123',
    });
    expect(loadRuntimeConnection({ search: '' }, storage)).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc123',
    });
  });

  it('is a no-op for a runtime the device has never dialled', () => {
    const storage = createStorage();
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    expect(selectRuntime('http://localhost:9999', storage)).toBeNull();
    expect(loadRuntimeConnection({ search: '' }, storage)).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc123',
    });
  });
});

describe('renameRuntime', () => {
  it('sets a device-local label on a known runtime', () => {
    const storage = createStorage();
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    expect(renameRuntime('http://localhost:3333', 'Paper Camp', storage)).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc123',
      label: 'Paper Camp',
    });
    expect(listRuntimes(storage)).toEqual([
      { runtimeUrl: 'http://localhost:3333', pairingToken: 'abc123', label: 'Paper Camp' },
    ]);
  });

  it('trims the label and clears it back to the announced name when blank', () => {
    const storage = createStorage();
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    renameRuntime('http://localhost:3333', '  Paper Camp  ', storage);
    expect(renameRuntime('http://localhost:3333', '  ', storage)).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc123',
    });
  });

  it('is a no-op for a runtime the device has never dialled', () => {
    const storage = createStorage();
    expect(renameRuntime('http://localhost:9999', 'Paper Camp', storage)).toBeNull();
    expect(listRuntimes(storage)).toEqual([]);
  });

  it('survives a re-dial that carries no label of its own', () => {
    const storage = createStorage();
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    renameRuntime('http://localhost:3333', 'Paper Camp', storage);
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    expect(listRuntimes(storage)).toEqual([
      { runtimeUrl: 'http://localhost:3333', pairingToken: 'abc123', label: 'Paper Camp' },
    ]);
  });
});

describe('removeRuntime', () => {
  it('forgets a registered runtime', () => {
    const storage = createStorage();
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A4444&token=def456' },
      storage,
    );
    removeRuntime('http://localhost:3333', storage);
    expect(listRuntimes(storage)).toEqual([
      { runtimeUrl: 'http://localhost:4444', pairingToken: 'def456' },
    ]);
  });

  it('clears the active runtime when it is the one removed', () => {
    const storage = createStorage();
    loadRuntimeConnection(
      { search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123' },
      storage,
    );
    removeRuntime('http://localhost:3333', storage);
    expect(loadRuntimeConnection({ search: '' }, storage)).toEqual({
      runtimeUrl: '',
      pairingToken: null,
    });
  });

  it('works without a storage backend', () => {
    expect(() => removeRuntime('http://localhost:3333', null)).not.toThrow();
  });
});
