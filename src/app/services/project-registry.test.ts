import { describe, expect, it } from 'vitest';
import {
  activeProjectId,
  listProjects,
  projectEntryId,
  removeProject,
  renameProject,
  selectProject,
  upsertRuntimeProject,
} from './project-registry';

function createStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map<string, string>(Object.entries(seed));
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

describe('listProjects', () => {
  it('is empty with nothing persisted', () => {
    expect(listProjects(createStorage())).toEqual([]);
  });

  it('works without a storage backend', () => {
    expect(listProjects(null)).toEqual([]);
  });

  it('drops a stored entry with no runtimeUrl, since nothing can open it any more', () => {
    const storage = createStorage({
      'paper-camp.projects': JSON.stringify([
        { kind: 'github', owner: 'croco-dendy', repo: 'paper-camp' },
        { runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' },
      ]),
    });
    expect(listProjects(storage)).toEqual([
      { runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' },
    ]);
  });
});

describe('upsertRuntimeProject', () => {
  it('adds a runtime entry', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    expect(listProjects(storage)).toEqual([
      { runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' },
    ]);
  });

  it('keeps entries for every runtime dialled, moving a re-dial to the end', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:4444', pairingToken: 'def' }, storage);
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: null }, storage);
    expect(listProjects(storage)).toEqual([
      { runtimeUrl: 'http://localhost:4444', pairingToken: 'def' },
      { runtimeUrl: 'http://localhost:3333', pairingToken: null },
    ]);
  });

  it('keeps a device-local label across a re-dial that carries none', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    renameProject('http://localhost:3333', 'Paper Camp', storage);
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    expect(listProjects(storage)).toEqual([
      {
        runtimeUrl: 'http://localhost:3333',
        pairingToken: 'abc',
        label: 'Paper Camp',
      },
    ]);
  });
});

describe('removeProject', () => {
  it('forgets a runtime entry and clears it as active', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    selectProject('http://localhost:3333', storage);
    removeProject('http://localhost:3333', storage);
    expect(listProjects(storage)).toEqual([]);
    expect(activeProjectId(storage)).toBeNull();
  });

  it('works without a storage backend', () => {
    expect(() => removeProject('http://localhost:3333', null)).not.toThrow();
  });
});

describe('renameProject', () => {
  it('sets a device-local label on a runtime entry', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    expect(renameProject('http://localhost:3333', 'Paper Camp', storage)).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc',
      label: 'Paper Camp',
    });
  });

  it('trims the label and clears it back to blank', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    renameProject('http://localhost:3333', '  Camp  ', storage);
    expect(renameProject('http://localhost:3333', '  ', storage)).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc',
    });
  });

  it('is a no-op for an id the device has never seen', () => {
    const storage = createStorage();
    expect(renameProject('http://localhost:9999', 'Paper Camp', storage)).toBeNull();
  });
});

describe('selectProject', () => {
  it('marks a known runtime entry active', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    expect(selectProject('http://localhost:3333', storage)).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc',
    });
    expect(activeProjectId(storage)).toBe('http://localhost:3333');
  });

  it('is a no-op for an id the device has never seen', () => {
    const storage = createStorage();
    expect(selectProject('http://localhost:9999', storage)).toBeNull();
    expect(activeProjectId(storage)).toBeNull();
  });
});

describe('projectEntryId', () => {
  it('is the runtime URL', () => {
    expect(projectEntryId({ runtimeUrl: 'http://localhost:3333', pairingToken: null })).toBe(
      'http://localhost:3333',
    );
  });
});

describe('migration from the pre-unification stores', () => {
  it('folds a legacy runtimes list and active runtime into the unified store', () => {
    const storage = createStorage({
      'paper-camp.runtimes': JSON.stringify([
        { runtimeUrl: 'http://localhost:3333', pairingToken: 'abc', label: 'Paper Camp' },
      ]),
      'paper-camp.activeRuntimeUrl': 'http://localhost:3333',
    });
    expect(listProjects(storage)).toEqual([
      {
        runtimeUrl: 'http://localhost:3333',
        pairingToken: 'abc',
        label: 'Paper Camp',
      },
    ]);
    expect(activeProjectId(storage)).toBe('http://localhost:3333');
  });

  it('runs only once, so a later add is not clobbered by re-migrating', () => {
    const storage = createStorage({
      'paper-camp.runtimes': JSON.stringify([
        { runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' },
      ]),
    });
    listProjects(storage);
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:4444', pairingToken: 'def' }, storage);
    expect(listProjects(storage)).toEqual([
      { runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' },
      { runtimeUrl: 'http://localhost:4444', pairingToken: 'def' },
    ]);
  });

  it('is a no-op with nothing legacy to migrate', () => {
    const storage = createStorage();
    expect(listProjects(storage)).toEqual([]);
    expect(activeProjectId(storage)).toBeNull();
  });
});
