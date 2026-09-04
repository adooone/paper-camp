import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const CLI_ENTRY = join(__dirname, 'index.ts');

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function runCli(args: string[], configDir: string, cwd?: string): SpawnSyncReturns<string> {
  return spawnSync('bun', [CLI_ENTRY, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, PAPERCAMP_CONFIG_DIR: configDir },
    cwd,
  });
}

async function makeProjectDir(root: string, name: string, hasConfig: boolean): Promise<void> {
  const projectDir = join(root, name);
  if (hasConfig) {
    await mkdir(join(projectDir, 'papercamp'), { recursive: true });
    await writeFile(join(projectDir, 'papercamp', 'config.json'), '{}', 'utf-8');
  } else {
    await mkdir(projectDir, { recursive: true });
  }
}

// One process-boundary suite for all three commands together: `scan` populates the
// registry `ls` and `rm` then read back, all against a PAPERCAMP_CONFIG_DIR-redirected
// registry so a crash mid-suite can never touch the real one at ~/.config/paper-camp.
describe('paper-camp scan / ls / rm (CLI)', () => {
  it('scan skips a directory with no papercamp/config.json and registers the rest', async () => {
    const configDir = await makeTempDir('paper-camp-config-');
    const scanRoot = await makeTempDir('paper-camp-scan-');
    await makeProjectDir(scanRoot, 'with-config', true);
    await makeProjectDir(scanRoot, 'without-config', false);

    const result = runCli(['scan', scanRoot], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Added:');
    expect(result.stdout).toContain('with-config');
    expect(result.stdout).toContain('Skipped:');
    expect(result.stdout).toContain('without-config — no papercamp/config.json');

    const registry = JSON.parse(await readFile(join(configDir, 'projects.json'), 'utf-8'));
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0]).toMatchObject({
      slug: 'with-config',
      path: join(scanRoot, 'with-config'),
    });
  });

  it('ls reports no projects against a fresh registry, then lists what scan added', async () => {
    const configDir = await makeTempDir('paper-camp-config-');
    const scanRoot = await makeTempDir('paper-camp-scan-');

    const empty = runCli(['ls'], configDir);
    expect(empty.status).toBe(0);
    expect(empty.stdout).toContain('No projects registered.');

    await makeProjectDir(scanRoot, 'demo', true);
    runCli(['scan', scanRoot], configDir);

    const populated = runCli(['ls'], configDir);
    expect(populated.status).toBe(0);
    expect(populated.stdout).toContain('demo');
    expect(populated.stdout).toContain(join(scanRoot, 'demo'));
  });

  it('rm removes a registered project and fails for an unknown slug', async () => {
    const configDir = await makeTempDir('paper-camp-config-');
    const scanRoot = await makeTempDir('paper-camp-scan-');
    await makeProjectDir(scanRoot, 'demo', true);
    runCli(['scan', scanRoot], configDir);

    const removed = runCli(['rm', 'demo'], configDir);
    expect(removed.status).toBe(0);
    expect(removed.stdout).toContain('Removed "demo" from the registry.');

    const afterRemoval = runCli(['ls'], configDir);
    expect(afterRemoval.stdout).toContain('No projects registered.');

    const unknown = runCli(['rm', 'demo'], configDir);
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('No registered project with slug "demo"');
  });

  it('init registers the project, and stays clean if the path is already registered', async () => {
    const configDir = await makeTempDir('paper-camp-config-');
    const projectDir = await makeTempDir('paper-camp-init-');

    const result = runCli(['init'], configDir, projectDir);
    expect(result.status).toBe(0);

    const registry = JSON.parse(await readFile(join(configDir, 'projects.json'), 'utf-8'));
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0]).toMatchObject({ path: projectDir });

    await rm(join(projectDir, 'papercamp', 'config.json'));
    const rerun = runCli(['init'], configDir, projectDir);
    expect(rerun.status).toBe(0);

    const registryAfterRerun = JSON.parse(
      await readFile(join(configDir, 'projects.json'), 'utf-8'),
    );
    expect(registryAfterRerun.projects).toHaveLength(1);
  });
});
