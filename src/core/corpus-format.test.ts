import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CORPUS_FORMAT_VERSION,
  CorpusTooNewError,
  assertCorpusWritable,
  bumpCorpusFormat,
} from './corpus-format';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function writeConfig(version: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'papercamp-corpus-format-'));
  dirs.push(dir);
  const configPath = join(dir, 'config.json');
  await writeFile(configPath, JSON.stringify({ version }), 'utf-8');
  return configPath;
}

describe('assertCorpusWritable', () => {
  it('allows a corpus at the current format version', async () => {
    const configPath = await writeConfig(CORPUS_FORMAT_VERSION);
    await expect(assertCorpusWritable(configPath)).resolves.toBeUndefined();
  });

  it('allows a corpus older than the current format version', async () => {
    const configPath = await writeConfig(CORPUS_FORMAT_VERSION - 1);
    await expect(assertCorpusWritable(configPath)).resolves.toBeUndefined();
  });

  it('refuses a corpus newer than the current format version', async () => {
    const configPath = await writeConfig(CORPUS_FORMAT_VERSION + 1);
    await expect(assertCorpusWritable(configPath)).rejects.toBeInstanceOf(CorpusTooNewError);
  });

  it('allows a corpus with no version stamped', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'papercamp-corpus-format-'));
    dirs.push(dir);
    const configPath = join(dir, 'config.json');
    await writeFile(configPath, JSON.stringify({ projectName: 'demo' }), 'utf-8');
    await expect(assertCorpusWritable(configPath)).resolves.toBeUndefined();
  });

  it('allows a missing config.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'papercamp-corpus-format-'));
    dirs.push(dir);
    await expect(assertCorpusWritable(join(dir, 'config.json'))).resolves.toBeUndefined();
  });
});

describe('bumpCorpusFormat', () => {
  it('stamps an unversioned corpus with the current format version', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'papercamp-corpus-format-'));
    dirs.push(dir);
    const configPath = join(dir, 'config.json');
    await writeFile(configPath, JSON.stringify({ projectName: 'demo' }), 'utf-8');

    const bump = await bumpCorpusFormat(configPath);
    expect(bump).toEqual({ from: null, to: CORPUS_FORMAT_VERSION });

    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(config).toEqual({ projectName: 'demo', version: CORPUS_FORMAT_VERSION });
  });

  it('bumps a corpus stamped with an older format version', async () => {
    const configPath = await writeConfig(CORPUS_FORMAT_VERSION - 1);

    const bump = await bumpCorpusFormat(configPath);
    expect(bump).toEqual({ from: CORPUS_FORMAT_VERSION - 1, to: CORPUS_FORMAT_VERSION });

    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(config.version).toBe(CORPUS_FORMAT_VERSION);
  });

  it('replaces a non-numeric legacy version value', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'papercamp-corpus-format-'));
    dirs.push(dir);
    const configPath = join(dir, 'config.json');
    await writeFile(configPath, JSON.stringify({ version: '0.1.0' }), 'utf-8');

    const bump = await bumpCorpusFormat(configPath);
    expect(bump).toEqual({ from: null, to: CORPUS_FORMAT_VERSION });

    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(config.version).toBe(CORPUS_FORMAT_VERSION);
  });

  it('is a no-op once the corpus is already at the current format version', async () => {
    const configPath = await writeConfig(CORPUS_FORMAT_VERSION);
    await expect(bumpCorpusFormat(configPath)).resolves.toBeNull();
  });

  it('is a no-op when the corpus is newer than this paper-camp understands', async () => {
    const configPath = await writeConfig(CORPUS_FORMAT_VERSION + 1);
    await expect(bumpCorpusFormat(configPath)).resolves.toBeNull();
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(config.version).toBe(CORPUS_FORMAT_VERSION + 1);
  });

  it('is a no-op for a missing config.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'papercamp-corpus-format-'));
    dirs.push(dir);
    await expect(bumpCorpusFormat(join(dir, 'config.json'))).resolves.toBeNull();
  });
});
