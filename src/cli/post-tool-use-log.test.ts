import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { logNewFile } from './post-tool-use-log';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeProject(config: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-post-tool-use-'));
  dirs.push(root);
  await mkdir(join(root, 'papercamp'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'config.json'), JSON.stringify(config));
  return root;
}

describe('logNewFile', () => {
  it('is a no-op when autoLogNewFiles is unset (off by default)', async () => {
    const root = await makeProject({});

    await logNewFile(root, {
      tool_name: 'Write',
      tool_input: { file_path: join(root, 'src', 'new.ts') },
      tool_response: { structuredPatch: [] },
    });

    await expect(readFile(join(root, 'papercamp', 'progress.md'), 'utf-8')).rejects.toThrow();
  });

  it('logs a new file when enabled, the tool is Write, and structuredPatch is empty', async () => {
    const root = await makeProject({ autoLogNewFiles: true });

    await logNewFile(root, {
      tool_name: 'Write',
      tool_input: { file_path: join(root, 'src', 'new.ts') },
      tool_response: { structuredPatch: [] },
    });

    const progress = await readFile(join(root, 'papercamp', 'progress.md'), 'utf-8');
    expect(progress).toContain('New file: src/new.ts');
  });

  it('ignores a Write that overwrites existing content (non-empty structuredPatch)', async () => {
    const root = await makeProject({ autoLogNewFiles: true });

    await logNewFile(root, {
      tool_name: 'Write',
      tool_input: { file_path: join(root, 'src', 'existing.ts') },
      tool_response: { structuredPatch: [{ lines: ['- old', '+ new'] }] },
    });

    await expect(readFile(join(root, 'papercamp', 'progress.md'), 'utf-8')).rejects.toThrow();
  });

  it('ignores non-Write tools (reads, searches, bash)', async () => {
    const root = await makeProject({ autoLogNewFiles: true });

    await logNewFile(root, {
      tool_name: 'Bash',
      tool_input: { file_path: join(root, 'src', 'new.ts') },
      tool_response: {},
    });

    await expect(readFile(join(root, 'papercamp', 'progress.md'), 'utf-8')).rejects.toThrow();
  });

  it('is a no-op outside a papercamp/ project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'papercamp-post-tool-use-none-'));
    dirs.push(root);

    await logNewFile(root, {
      tool_name: 'Write',
      tool_input: { file_path: join(root, 'src', 'new.ts') },
      tool_response: { structuredPatch: [] },
    });

    await expect(readFile(join(root, 'papercamp', 'progress.md'), 'utf-8')).rejects.toThrow();
  });
});
