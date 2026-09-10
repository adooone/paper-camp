import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { detectToolbarHostState } from './toolbar-host';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-toolbar-host-'));
  dirs.push(root);
  return root;
}

describe('detectToolbarHostState', () => {
  it('is all-absent for a repo with no vite config and no package.json', async () => {
    const root = await makeTempDir();

    expect(await detectToolbarHostState(root)).toEqual({
      viteConfigPath: null,
      importsPlugin: false,
      isDependency: false,
    });
  });

  it('finds the vite config but reports no import and no dependency when neither is wired up', async () => {
    const root = await makeTempDir();
    await writeFile(join(root, 'vite.config.ts'), 'export default {}');
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'demo' }));

    expect(await detectToolbarHostState(root)).toEqual({
      viteConfigPath: 'vite.config.ts',
      importsPlugin: false,
      isDependency: false,
    });
  });

  it('detects the plugin import in the vite config', async () => {
    const root = await makeTempDir();
    await writeFile(
      join(root, 'vite.config.ts'),
      "import paperCamp from '@dendelion/paper-camp/vite';\nexport default { plugins: [paperCamp()] };",
    );
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'demo' }));

    const state = await detectToolbarHostState(root);

    expect(state.viteConfigPath).toBe('vite.config.ts');
    expect(state.importsPlugin).toBe(true);
  });

  it('detects the package as a dependency, and as a devDependency', async () => {
    const root = await makeTempDir();
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'demo', dependencies: { '@dendelion/paper-camp': '^1.0.0' } }),
    );

    expect((await detectToolbarHostState(root)).isDependency).toBe(true);

    const devRoot = await makeTempDir();
    await writeFile(
      join(devRoot, 'package.json'),
      JSON.stringify({ name: 'demo', devDependencies: { '@dendelion/paper-camp': '^1.0.0' } }),
    );

    expect((await detectToolbarHostState(devRoot)).isDependency).toBe(true);
  });

  it('picks the first vite config file it finds, preferring .ts', async () => {
    const root = await makeTempDir();
    await writeFile(join(root, 'vite.config.ts'), 'export default {}');
    await writeFile(join(root, 'vite.config.js'), 'export default {}');

    expect((await detectToolbarHostState(root)).viteConfigPath).toBe('vite.config.ts');
  });

  it('tolerates an unparsable package.json', async () => {
    const root = await makeTempDir();
    await writeFile(join(root, 'package.json'), 'not json');

    expect((await detectToolbarHostState(root)).isDependency).toBe(false);
  });
});
