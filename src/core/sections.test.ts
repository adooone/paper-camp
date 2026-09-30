import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from '../types/index';
import { THREAD_SECTION } from './sections';

function parse(lines: string[]): ThreadMessage[] {
  return THREAD_SECTION.parseEntries(lines, 0, lines.length);
}

describe('THREAD_SECTION option:/context: continuation lines', () => {
  it('parses an option: line into label and consequence, split on the em-dash', () => {
    const lines = [
      '- [ ] 2026-08-01 [question] Ship now or wait?',
      '      option: Ship now — locks the API shape early',
      '      option: Wait — keeps flexibility but delays feedback',
    ];
    const [message] = parse(lines);
    expect(message.options).toEqual([
      { label: 'Ship now', consequence: 'locks the API shape early' },
      { label: 'Wait', consequence: 'keeps flexibility but delays feedback' },
    ]);
  });

  it('falls back to the full line as the label when there is no em-dash', () => {
    const lines = ['- [ ] [question] Pick one', '      option: Just ship it'];
    const [message] = parse(lines);
    expect(message.options).toEqual([{ label: 'Just ship it', consequence: '' }]);
  });

  it('parses a context: line separately from options', () => {
    const lines = [
      '- [ ] [question] Ship now or wait?',
      '      option: Ship now — locks the API shape early',
      '      context: Users are blocked on this today',
    ];
    const [message] = parse(lines);
    expect(message.context).toBe('Users are blocked on this today');
    expect(message.options).toEqual([
      { label: 'Ship now', consequence: 'locks the API shape early' },
    ]);
  });

  it('round-trips options and context through formatLines', () => {
    const messages: ThreadMessage[] = [
      {
        kind: 'question',
        date: '2026-08-01',
        text: 'Ship now or wait?',
        state: 'open',
        options: [
          { label: 'Ship now', consequence: 'locks the API shape early' },
          { label: 'Wait', consequence: 'keeps flexibility' },
        ],
        context: 'Users are blocked on this today',
      },
    ];
    const formatted = THREAD_SECTION.formatLines(messages);
    const reparsed = parse(formatted.slice(1));
    expect(reparsed).toEqual(messages);
  });

  it('omits options/context fields entirely when absent', () => {
    const lines = ['- [x] [decision] We went with Y.'];
    const [message] = parse(lines);
    expect(message.options).toBeUndefined();
    expect(message.context).toBeUndefined();
  });
});
