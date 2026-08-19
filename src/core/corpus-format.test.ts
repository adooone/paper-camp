import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CORPUS_FORMAT_VERSION, CorpusTooNewError, assertCorpusWritable } from './corpus-format';

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
