import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  buildPermissionsAllow,
  buildSessionStartCommand,
  detectPackageManager,
  hasPaperCampDependency,
  mergeClaudeSettingsJson,
} from './templates';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

describe('detectPackageManager', () => {
  it('defaults to npm when no lockfile is present', async () => {
    const dir = await makeTempDir('papercamp-templates-pm-none-');
    expect(detectPackageManager(dir)).toBe('npm');
  });

  it('detects pnpm from pnpm-lock.yaml', async () => {
    const dir = await makeTempDir('papercamp-templates-pm-pnpm-');
    await writeFile(join(dir, 'pnpm-lock.yaml'), '', 'utf-8');
    expect(detectPackageManager(dir)).toBe('pnpm');
  });

  it('detects yarn from yarn.lock', async () => {
    const dir = await makeTempDir('papercamp-templates-pm-yarn-');
    await writeFile(join(dir, 'yarn.lock'), '', 'utf-8');
    expect(detectPackageManager(dir)).toBe('yarn');
  });

  it('detects bun from bun.lockb', async () => {
    const dir = await makeTempDir('papercamp-templates-pm-bun-');
    await writeFile(join(dir, 'bun.lockb'), '', 'utf-8');
    expect(detectPackageManager(dir)).toBe('bun');
  });

  it('detects npm from package-lock.json', async () => {
    const dir = await makeTempDir('papercamp-templates-pm-npm-');
    await writeFile(join(dir, 'package-lock.json'), '', 'utf-8');
    expect(detectPackageManager(dir)).toBe('npm');
  });
});

describe('hasPaperCampDependency', () => {
  it('is false when there is no package.json', async () => {
    const dir = await makeTempDir('papercamp-templates-dep-none-');
    expect(hasPaperCampDependency(dir)).toBe(false);
  });

  it('is false when package.json does not depend on @dendelion/paper-camp', async () => {
    const dir = await makeTempDir('papercamp-templates-dep-other-');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      'utf-8',
    );
    expect(hasPaperCampDependency(dir)).toBe(false);
  });

  it('is true when @dendelion/paper-camp is a dependency', async () => {
    const dir = await makeTempDir('papercamp-templates-dep-dep-');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { '@dendelion/paper-camp': '^1.0.0' } }),
      'utf-8',
    );
    expect(hasPaperCampDependency(dir)).toBe(true);
  });

  it('is true when @dendelion/paper-camp is a devDependency', async () => {
    const dir = await makeTempDir('papercamp-templates-dep-devdep-');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { '@dendelion/paper-camp': '^1.0.0' } }),
      'utf-8',
    );
    expect(hasPaperCampDependency(dir)).toBe(true);
  });

  it('is false when package.json is malformed', async () => {
    const dir = await makeTempDir('papercamp-templates-dep-malformed-');
    await writeFile(join(dir, 'package.json'), '{not json', 'utf-8');
    expect(hasPaperCampDependency(dir)).toBe(false);
  });
});

describe('buildSessionStartCommand', () => {
  it('uses the global command when the project has no paper-camp dependency', () => {
    expect(buildSessionStartCommand(false)).toBe('paper-camp session-focus');
  });

  it('uses the node_modules bin when the project depends on paper-camp', () => {
    expect(buildSessionStartCommand(true)).toBe(
      '"$CLAUDE_PROJECT_DIR/node_modules/.bin/paper-camp" session-focus',
    );
  });
});

describe('buildPermissionsAllow', () => {
  it('includes edit/write entries for the standard directories and root globs', () => {
    const allow = buildPermissionsAllow('npm');
    expect(allow).toContain('Edit(src/**)');
    expect(allow).toContain('Write(src/**)');
    expect(allow).toContain('Edit(app/**)');
    expect(allow).toContain('Edit(scripts/**)');
    expect(allow).toContain('Edit(papercamp/**)');
    expect(allow).toContain('Edit(*.json)');
    expect(allow).toContain('Edit(*.ts)');
    expect(allow).toContain('Edit(*.tsx)');
    expect(allow).toContain('Edit(*.md)');
    expect(allow).toContain('Edit(*.config.*)');
  });

  it('includes read-only git, ls/cat/wc, and npx entries', () => {
    const allow = buildPermissionsAllow('npm');
    expect(allow).toContain('Bash(git status*)');
    expect(allow).toContain('Bash(git diff*)');
    expect(allow).toContain('Bash(git log*)');
    expect(allow).toContain('Bash(ls*)');
    expect(allow).toContain('Bash(cat*)');
    expect(allow).toContain('Bash(wc*)');
    expect(allow).toContain('Bash(npx tsc*)');
    expect(allow).toContain('Bash(npx biome check*)');
    expect(allow).toContain('Bash(npx vitest*)');
    expect(allow).toContain('Bash(npx jest*)');
    expect(allow).toContain('Bash(npx expo *)');
  });

  it('scopes the package-manager verbs to the detected manager', () => {
    expect(buildPermissionsAllow('pnpm')).toEqual(
      expect.arrayContaining([
        'Bash(pnpm run *)',
        'Bash(pnpm test*)',
        'Bash(pnpm install*)',
        'Bash(pnpm view *)',
        'Bash(pnpm pack*)',
        'Bash(pnpm ls*)',
      ]),
    );
    expect(buildPermissionsAllow('yarn')).toEqual(
      expect.arrayContaining(['Bash(yarn run *)', 'Bash(yarn pack*)']),
    );
    expect(buildPermissionsAllow('bun')).toEqual(
      expect.arrayContaining(['Bash(bun run *)', 'Bash(bun install*)']),
    );
    expect(buildPermissionsAllow('pnpm')).not.toContain('Bash(npm run *)');
  });
});

describe('mergeClaudeSettingsJson', () => {
  it('adds a permissions.allow list when the file has none', async () => {
    const dir = await makeTempDir('papercamp-templates-merge-add-');
    const merged = mergeClaudeSettingsJson('{"custom":true}\n', dir);
    const parsed = JSON.parse(merged);
    expect(parsed.custom).toBe(true);
    expect(parsed.permissions.allow).toContain('Edit(src/**)');
  });

  it('keeps existing allow entries and only appends what is missing', async () => {
    const dir = await makeTempDir('papercamp-templates-merge-append-');
    const existing = `${JSON.stringify({ permissions: { allow: ['Bash(custom command*)'] } }, null, 2)}\n`;
    const merged = mergeClaudeSettingsJson(existing, dir);
    const parsed = JSON.parse(merged);
    expect(parsed.permissions.allow).toContain('Bash(custom command*)');
    expect(parsed.permissions.allow).toContain('Edit(src/**)');
  });

  it('is a no-op when the allow list already covers every generated entry', async () => {
    const dir = await makeTempDir('papercamp-templates-merge-noop-');
    const generated = buildPermissionsAllow(detectPackageManager(dir));
    const existing = `${JSON.stringify({ permissions: { allow: generated } }, null, 2)}\n`;
    expect(mergeClaudeSettingsJson(existing, dir)).toBe(existing);
  });

  it('leaves the hook untouched', async () => {
    const dir = await makeTempDir('papercamp-templates-merge-hook-');
    const existing = `${JSON.stringify(
      {
        hooks: {
          SessionStart: [{ matcher: '*', hooks: [{ type: 'command', command: 'my-hook' }] }],
        },
      },
      null,
      2,
    )}\n`;
    const merged = mergeClaudeSettingsJson(existing, dir);
    const parsed = JSON.parse(merged);
    expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe('my-hook');
  });

  it('returns the content unchanged when it is not valid JSON', () => {
    const dir = '/nonexistent';
    expect(mergeClaudeSettingsJson('not json', dir)).toBe('not json');
  });

  it('does not duplicate entries already present, regardless of order', async () => {
    const dir = await makeTempDir('papercamp-templates-merge-dup-');
    const generated = buildPermissionsAllow(detectPackageManager(dir));
    const existing = `${JSON.stringify({ permissions: { allow: [...generated].reverse() } }, null, 2)}\n`;
    const merged = mergeClaudeSettingsJson(existing, dir);
    const parsed = JSON.parse(merged);
    for (const entry of generated) {
      expect(parsed.permissions.allow.filter((e: string) => e === entry)).toHaveLength(1);
    }
  });
});
