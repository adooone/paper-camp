import { describe, expect, it } from 'vitest';
import { buildNightCheckPrompt, buildNightConfirmPrompt } from './night-prompts';

describe('buildNightCheckPrompt', () => {
  it('includes the chunk, file list, instructions, and JSON-shape instruction', () => {
    const prompt = buildNightCheckPrompt({
      name: 'bugs',
      instructions: 'logic errors and edge cases',
      chunkPath: 'src/core',
      files: ['src/core/a.ts', 'src/core/b.ts'],
      sinceCommit: 'abc123',
      diff: '+added a line',
    });
    expect(prompt).toContain('src/core');
    expect(prompt).toContain('src/core/a.ts');
    expect(prompt).toContain('src/core/b.ts');
    expect(prompt).toContain('logic errors and edge cases');
    expect(prompt).toContain('abc123');
    expect(prompt).toContain('+added a line');
    expect(prompt).toContain('must not edit, write, or otherwise modify');
    expect(prompt).toContain('JSON array');
  });

  it('says this is the first review when there is no prior commit', () => {
    const prompt = buildNightCheckPrompt({
      name: 'bugs',
      instructions: 'logic errors',
      chunkPath: 'src/core',
      files: [],
      sinceCommit: null,
      diff: '',
    });
    expect(prompt).toContain('first review of this chunk');
    expect(prompt).toContain('(no files in this chunk)');
  });
});

describe('buildNightConfirmPrompt', () => {
  it('includes the file, line, message, and severity rubric', () => {
    const prompt = buildNightConfirmPrompt({
      checkName: 'security',
      finding: { file: 'src/core/a.ts', line: 42, message: 'possible injection' },
    });
    expect(prompt).toContain('src/core/a.ts');
    expect(prompt).toContain('42');
    expect(prompt).toContain('possible injection');
    expect(prompt).toContain('critical');
    expect(prompt).toContain('high');
    expect(prompt).toContain('normal');
    expect(prompt).toContain('must not edit, write, or otherwise modify');
  });

  it('reports an unspecified line when the finding has none', () => {
    const prompt = buildNightConfirmPrompt({
      checkName: 'bugs',
      finding: { file: 'src/core/a.ts', line: null, message: 'x' },
    });
    expect(prompt).toContain('unspecified');
  });
});
