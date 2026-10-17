import { describe, expect, it } from 'vitest';
import { parseEntityLinks } from './entity-link-text';

describe('parseEntityLinks', () => {
  it('matches a wikilinked id and labels it with the known title', () => {
    const matches = parseEntityLinks('See [[IDEA-301]] for details.', [
      { id: 'IDEA-301', title: 'Chat sounds like Scout' },
    ]);
    expect(matches).toEqual([
      { id: 'IDEA-301', label: 'IDEA-301 · Chat sounds like Scout', start: 4, end: 16 },
    ]);
  });

  it('matches a bare id with no brackets', () => {
    const matches = parseEntityLinks('Filed as IDEA-42.', [{ id: 'IDEA-42', title: 'Thing' }]);
    expect(matches).toEqual([{ id: 'IDEA-42', label: 'IDEA-42 · Thing', start: 9, end: 16 }]);
  });

  it('falls back to the bare id when the title is unknown', () => {
    const matches = parseEntityLinks('[[IDEA-999]]', []);
    expect(matches).toEqual([{ id: 'IDEA-999', label: 'IDEA-999', start: 0, end: 12 }]);
  });

  it('finds every occurrence without double-matching the bracketed form', () => {
    const matches = parseEntityLinks('[[IDEA-1]] and IDEA-2 and [[IDEA-1]] again', [
      { id: 'IDEA-1', title: 'First' },
      { id: 'IDEA-2', title: 'Second' },
    ]);
    expect(matches.map((m) => m.id)).toEqual(['IDEA-1', 'IDEA-2', 'IDEA-1']);
  });

  it('returns no matches for plain text', () => {
    expect(parseEntityLinks('Nothing to link here.', [])).toEqual([]);
  });
});
