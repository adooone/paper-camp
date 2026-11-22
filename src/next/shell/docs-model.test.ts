import { describe, expect, it } from 'vitest';
import {
  isMarkdownDoc,
  releaseMarkdown,
  resultsLine,
  searchDocs,
  snippetAround,
} from './docs-model';

const docs = [
  { name: 'MAIN.md', content: 'Paper camp keeps ideas on paper.' },
  { name: 'CODE_STYLE.md', content: 'Use folk-ui components by default.' },
];

describe('searchDocs', () => {
  it('matches a name or a body, case-insensitively', () => {
    expect(searchDocs(docs, 'code_style').map((match) => match.name)).toEqual(['CODE_STYLE.md']);
    expect(searchDocs(docs, 'ON PAPER').map((match) => match.name)).toEqual(['MAIN.md']);
    expect(searchDocs(docs, 'zzz')).toEqual([]);
    expect(searchDocs(docs, '   ')).toEqual([]);
  });

  it('trims the snippet around the hit with ellipses', () => {
    const text = `${'a'.repeat(100)}needle${'b'.repeat(100)}`;
    expect(snippetAround(text, 'needle')).toBe(`…${'a'.repeat(40)}needle${'b'.repeat(40)}…`);
    expect(snippetAround('short needle here', 'needle')).toBe('short needle here');
    expect(snippetAround('x'.repeat(300), 'nope')).toHaveLength(120);
  });
});

describe('copy', () => {
  it('recognises markdown docs and phrases the result count', () => {
    expect(isMarkdownDoc('A.md')).toBe(true);
    expect(isMarkdownDoc('config.json')).toBe(false);
    expect(resultsLine(1, ' x ')).toBe('1 result for "x"');
    expect(resultsLine(3, 'x')).toBe('3 results for "x"');
  });

  it('writes a release as one markdown list per section', () => {
    expect(
      releaseMarkdown([
        {
          label: 'Features',
          ideas: [
            { id: 'IDEA-1', title: 'One' },
            { id: null, title: 'Two' },
          ],
        },
      ] as never),
    ).toBe('### Features\n\n- **One** (IDEA-1)\n- Two');
  });
});
