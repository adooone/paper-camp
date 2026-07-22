import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ensureSubject } from './serializer';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeConfig(subjects: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-ensure-subject-'));
  dirs.push(root);
  const configPath = join(root, 'config.json');
  await writeFile(configPath, JSON.stringify({ subjects }));
  return configPath;
}

describe('ensureSubject', () => {
  it('appends a new subject', async () => {
    const configPath = await makeConfig(['Frontend']);
    await ensureSubject(configPath, 'Mobile control desk');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(config.subjects).toEqual(['Frontend', 'Mobile control desk']);
  });

  it('leaves an already-present subject untouched', async () => {
    const configPath = await makeConfig(['Frontend', 'Workflow']);
    await ensureSubject(configPath, 'Workflow');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(config.subjects).toEqual(['Frontend', 'Workflow']);
  });
});
