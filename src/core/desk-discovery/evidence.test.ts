import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gatherProjectEvidence } from './evidence';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-evidence-'));
  dirs.push(root);
  return root;
}

async function writePackageJson(root: string, scripts: Record<string, string>) {
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'demo', scripts }));
}

function initGitRepo(root: string, originUrl?: string) {
  spawnSync('git', ['init', '-q'], { cwd: root });
  if (originUrl) {
    spawnSync('git', ['remote', 'add', 'origin', originUrl], { cwd: root });
  }
}

describe('gatherProjectEvidence', () => {
  it('returns all-absent facts for an empty directory', async () => {
    const root = await makeTempDir();

    const evidence = await gatherProjectEvidence(root);

    expect(evidence).toEqual({
      packageManager: null,
      scripts: [],
      devPort: null,
      gitOriginSlug: null,
      hasCiWorkflows: false,
      hasReleasePlease: false,
      nonJsManifests: [],
    });
  });

  it('detects the package manager from its lockfile', async () => {
    const root = await makeTempDir();
    await writeFile(join(root, 'pnpm-lock.yaml'), '');

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.packageManager).toBe('pnpm');
  });

  it('reads package.json scripts verbatim', async () => {
    const root = await makeTempDir();
    await writePackageJson(root, { build: 'tsc', test: 'vitest run' });

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.scripts).toEqual([
      { name: 'build', cmd: 'tsc' },
      { name: 'test', cmd: 'vitest run' },
    ]);
  });

  it('detects the dev port from the dev script --port flag', async () => {
    const root = await makeTempDir();
    await writePackageJson(root, { dev: 'vite --port 3333' });

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.devPort).toBe(3333);
  });

  it('falls back to a framework config file for the dev port', async () => {
    const root = await makeTempDir();
    await writePackageJson(root, { dev: 'vite' });
    await writeFile(join(root, 'vite.config.ts'), 'export default { server: { port: 4321 } };\n');

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.devPort).toBe(4321);
  });

  it('only reads the dev port from a server block, not stray port literals', async () => {
    const root = await makeTempDir();
    await writePackageJson(root, { dev: 'vite' });
    await writeFile(
      join(root, 'vite.config.ts'),
      'export default { preview: { port: 9999 }, server: { port: 4321 } };\n',
    );

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.devPort).toBe(4321);
  });

  it('ignores a nested port inside the server block, like hmr.port', async () => {
    const root = await makeTempDir();
    await writePackageJson(root, { dev: 'vite' });
    await writeFile(
      join(root, 'vite.config.ts'),
      'export default { server: { hmr: { port: 24678 }, port: 4321 } };\n',
    );

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.devPort).toBe(4321);
  });

  it('returns null when no port lives inside the server block', async () => {
    const root = await makeTempDir();
    await writePackageJson(root, { dev: 'vite' });
    await writeFile(
      join(root, 'vite.config.ts'),
      'export default { preview: { port: 9999 }, server: { host: "0.0.0.0" } };\n',
    );

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.devPort).toBeNull();
  });

  it('resolves an owner/repo slug from an SSH origin', async () => {
    const root = await makeTempDir();
    initGitRepo(root, 'git@github.com:acme/widgets.git');

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.gitOriginSlug).toBe('acme/widgets');
  });

  it('resolves an owner/repo slug from an HTTPS origin', async () => {
    const root = await makeTempDir();
    initGitRepo(root, 'https://github.com/acme/widgets.git');

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.gitOriginSlug).toBe('acme/widgets');
  });

  it('is absent when there is no origin remote', async () => {
    const root = await makeTempDir();
    initGitRepo(root);

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.gitOriginSlug).toBeNull();
  });

  it('detects CI workflows and release-please config', async () => {
    const root = await makeTempDir();
    await mkdir(join(root, '.github', 'workflows'), { recursive: true });
    await writeFile(join(root, '.github', 'workflows', 'ci.yml'), 'name: CI\n');
    await writeFile(join(root, '.github', 'release-please-config.json'), '{}');

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.hasCiWorkflows).toBe(true);
    expect(evidence.hasReleasePlease).toBe(true);
  });

  it('treats an empty workflows directory as absent', async () => {
    const root = await makeTempDir();
    await mkdir(join(root, '.github', 'workflows'), { recursive: true });

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.hasCiWorkflows).toBe(false);
  });

  it('parses Cargo.toml bin/package names as targets', async () => {
    const root = await makeTempDir();
    await writeFile(
      join(root, 'Cargo.toml'),
      '[package]\nname = "widgets"\n\n[[bin]]\nname = "widgets-cli"\n',
    );

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.nonJsManifests).toEqual([
      { kind: 'cargo', path: 'Cargo.toml', targets: ['widgets', 'widgets-cli'] },
    ]);
  });

  it('parses pyproject.toml script entries as targets', async () => {
    const root = await makeTempDir();
    await writeFile(
      join(root, 'pyproject.toml'),
      '[project]\nname = "widgets"\n\n[project.scripts]\nwidgets = "widgets.cli:main"\n',
    );

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.nonJsManifests).toEqual([
      { kind: 'python', path: 'pyproject.toml', targets: ['widgets'] },
    ]);
  });

  it('parses the go.mod module path as its sole target', async () => {
    const root = await makeTempDir();
    await writeFile(join(root, 'go.mod'), 'module github.com/acme/widgets\n\ngo 1.22\n');

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.nonJsManifests).toEqual([
      { kind: 'go', path: 'go.mod', targets: ['github.com/acme/widgets'] },
    ]);
  });

  it('parses Makefile targets, excluding special ones', async () => {
    const root = await makeTempDir();
    await writeFile(
      join(root, 'Makefile'),
      'CFLAGS := -O2\n\nbuild:\n\tgo build\n\n.PHONY: build test\ntest:\n\tgo test ./...\n',
    );

    const evidence = await gatherProjectEvidence(root);

    expect(evidence.nonJsManifests).toEqual([
      { kind: 'make', path: 'Makefile', targets: ['build', 'test'] },
    ]);
  });
});
