import { describe, expect, it } from 'vitest';
import {
  activeProjectId,
  addGithubProject,
  listGithubRepoNames,
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
});

describe('upsertRuntimeProject', () => {
  it('adds a runtime entry', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    expect(listProjects(storage)).toEqual([
      { kind: 'runtime', runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' },
    ]);
  });

  it('keeps entries for every runtime dialled, moving a re-dial to the end', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:4444', pairingToken: 'def' }, storage);
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: null }, storage);
    expect(listProjects(storage)).toEqual([
      { kind: 'runtime', runtimeUrl: 'http://localhost:4444', pairingToken: 'def' },
      { kind: 'runtime', runtimeUrl: 'http://localhost:3333', pairingToken: null },
    ]);
  });

  it('keeps a device-local label across a re-dial that carries none', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    renameProject('http://localhost:3333', 'Paper Camp', storage);
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    expect(listProjects(storage)).toEqual([
      {
        kind: 'runtime',
        runtimeUrl: 'http://localhost:3333',
        pairingToken: 'abc',
        label: 'Paper Camp',
      },
    ]);
  });
});

describe('addGithubProject', () => {
  it('adds a GitHub entry split from owner/repo', () => {
    const storage = createStorage();
    addGithubProject('croco-dendy/paper-camp', storage);
    expect(listProjects(storage)).toEqual([
      { kind: 'github', owner: 'croco-dendy', repo: 'paper-camp' },
    ]);
  });

  it('does not duplicate a repo already chosen', () => {
    const storage = createStorage();
    addGithubProject('croco-dendy/paper-camp', storage);
    addGithubProject('croco-dendy/paper-camp', storage);
    expect(listGithubRepoNames(storage)).toEqual(['croco-dendy/paper-camp']);
  });

  it('keeps every repo chosen alongside any runtime entries', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    addGithubProject('croco-dendy/paper-camp', storage);
    addGithubProject('croco-dendy/paper-ui', storage);
    expect(listGithubRepoNames(storage)).toEqual([
      'croco-dendy/paper-camp',
      'croco-dendy/paper-ui',
    ]);
    expect(listProjects(storage)).toHaveLength(3);
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

  it('forgets a GitHub entry without touching an unrelated active runtime', () => {
    const storage = createStorage();
    upsertRuntimeProject({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' }, storage);
    selectProject('http://localhost:3333', storage);
    addGithubProject('croco-dendy/paper-camp', storage);
    removeProject('croco-dendy/paper-camp', storage);
    expect(listGithubRepoNames(storage)).toEqual([]);
    expect(activeProjectId(storage)).toBe('http://localhost:3333');
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
      kind: 'runtime',
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc',
      label: 'Paper Camp',
    });
  });

  it('sets a device-local label on a GitHub entry', () => {
    const storage = createStorage();
    addGithubProject('croco-dendy/paper-camp', storage);
    expect(renameProject('croco-dendy/paper-camp', 'Camp', storage)).toEqual({
      kind: 'github',
      owner: 'croco-dendy',
      repo: 'paper-camp',
      label: 'Camp',
    });
  });

  it('trims the label and clears it back to blank', () => {
    const storage = createStorage();
    addGithubProject('croco-dendy/paper-camp', storage);
    renameProject('croco-dendy/paper-camp', '  Camp  ', storage);
    expect(renameProject('croco-dendy/paper-camp', '  ', storage)).toEqual({
      kind: 'github',
      owner: 'croco-dendy',
      repo: 'paper-camp',
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
      kind: 'runtime',
      runtimeUrl: 'http://localhost:3333',
      pairingToken: 'abc',
    });
    expect(activeProjectId(storage)).toBe('http://localhost:3333');
  });

  it('marks a known GitHub entry active', () => {
    const storage = createStorage();
    addGithubProject('croco-dendy/paper-camp', storage);
    expect(selectProject('croco-dendy/paper-camp', storage)).toEqual({
      kind: 'github',
      owner: 'croco-dendy',
      repo: 'paper-camp',
    });
    expect(activeProjectId(storage)).toBe('croco-dendy/paper-camp');
  });

  it('is a no-op for an id the device has never seen', () => {
    const storage = createStorage();
    expect(selectProject('http://localhost:9999', storage)).toBeNull();
    expect(activeProjectId(storage)).toBeNull();
  });
});

describe('projectEntryId', () => {
  it('is the runtime URL for a runtime entry', () => {
    expect(
      projectEntryId({ kind: 'runtime', runtimeUrl: 'http://localhost:3333', pairingToken: null }),
    ).toBe('http://localhost:3333');
  });

  it('is owner/repo for a GitHub entry', () => {
    expect(projectEntryId({ kind: 'github', owner: 'croco-dendy', repo: 'paper-camp' })).toBe(
      'croco-dendy/paper-camp',
    );
  });
});

describe('migration from the pre-unification stores', () => {
  it('folds a legacy runtimes list, active runtime, and hub repo list into one store', () => {
    const storage = createStorage({
      'paper-camp.runtimes': JSON.stringify([
        { runtimeUrl: 'http://localhost:3333', pairingToken: 'abc', label: 'Paper Camp' },
      ]),
      'paper-camp.activeRuntimeUrl': 'http://localhost:3333',
      'paper-camp.hubRepos': JSON.stringify(['croco-dendy/paper-ui']),
    });
    expect(listProjects(storage)).toEqual([
      {
        kind: 'runtime',
        runtimeUrl: 'http://localhost:3333',
        pairingToken: 'abc',
        label: 'Paper Camp',
      },
      { kind: 'github', owner: 'croco-dendy', repo: 'paper-ui' },
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
    addGithubProject('croco-dendy/paper-camp', storage);
    expect(listProjects(storage)).toEqual([
      { kind: 'runtime', runtimeUrl: 'http://localhost:3333', pairingToken: 'abc' },
      { kind: 'github', owner: 'croco-dendy', repo: 'paper-camp' },
    ]);
  });

  it('is a no-op with nothing legacy to migrate', () => {
    const storage = createStorage();
    expect(listProjects(storage)).toEqual([]);
    expect(activeProjectId(storage)).toBeNull();
  });
});
