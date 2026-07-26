import { describe, expect, it } from 'vitest';
import { formatRunOrderFile, parseRunOrderFile } from './run-order-file';

describe('parseRunOrderFile', () => {
  it('parses one id + title per line, in file order', () => {
    const content = 'IDEA-1 — First\nIDEA-2 — Second\nIDEA-3 — Third\n';
    expect(parseRunOrderFile(content)).toEqual([
      { id: 'IDEA-1', title: 'First' },
      { id: 'IDEA-2', title: 'Second' },
      { id: 'IDEA-3', title: 'Third' },
    ]);
  });

  it('skips blank lines', () => {
    const content = 'IDEA-1 — First\n\n\nIDEA-2 — Second\n';
    expect(parseRunOrderFile(content)).toEqual([
      { id: 'IDEA-1', title: 'First' },
      { id: 'IDEA-2', title: 'Second' },
    ]);
  });

  it('treats a line with no separator as an id with an empty title', () => {
    expect(parseRunOrderFile('IDEA-1\n')).toEqual([{ id: 'IDEA-1', title: '' }]);
  });

  it('returns an empty list for empty content', () => {
    expect(parseRunOrderFile('')).toEqual([]);
  });

  it('keeps an em dash inside the title intact, splitting only on the first separator', () => {
    const content = 'IDEA-1 — Track run order — one file\n';
    expect(parseRunOrderFile(content)).toEqual([
      { id: 'IDEA-1', title: 'Track run order — one file' },
    ]);
  });
});

describe('formatRunOrderFile', () => {
  it('writes one id + title per line, first entry first, trailing newline', () => {
    const entries = [
      { id: 'IDEA-1', title: 'First' },
      { id: 'IDEA-2', title: 'Second' },
    ];
    expect(formatRunOrderFile(entries)).toBe('IDEA-1 — First\nIDEA-2 — Second\n');
  });

  it('returns an empty string for an empty list', () => {
    expect(formatRunOrderFile([])).toBe('');
  });

  it('round-trips through parse', () => {
    const entries = [
      { id: 'IDEA-1', title: 'Track run order in one file' },
      { id: 'IDEA-2', title: 'Another idea' },
    ];
    expect(parseRunOrderFile(formatRunOrderFile(entries))).toEqual(entries);
  });
});
