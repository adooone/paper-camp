import { describe, expect, it } from 'vitest';
import { parseReviewFindings } from '../review-findings';

describe('parseReviewFindings', () => {
  it('maps a findings array into unchecked review-sourced phases', () => {
    const phases = parseReviewFindings(
      JSON.stringify([
        {
          description: 'Missing null check on user.email',
          file: 'src/auth/validate.ts',
          line_start: 42,
          line_end: 48,
          failure_scenario: 'Throws on OAuth callbacks missing an email field',
        },
      ]),
    );
    expect(phases).toEqual([
      {
        done: false,
        text: 'Missing null check on user.email',
        description:
          'src/auth/validate.ts:42-48 — Throws on OAuth callbacks missing an email field',
        source: 'review',
      },
    ]);
  });

  it('accepts an object with a findings array', () => {
    const phases = parseReviewFindings(
      JSON.stringify({ findings: [{ title: 'Unused import', file: 'a.ts', line: 3 }] }),
    );
    expect(phases).toEqual([
      { done: false, text: 'Unused import', description: 'a.ts:3', source: 'review' },
    ]);
  });

  it('falls back to title/summary when description is absent', () => {
    const phases = parseReviewFindings(JSON.stringify([{ summary: 'Dead code path' }]));
    expect(phases[0]).toMatchObject({ text: 'Dead code path', description: undefined });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseReviewFindings('not json')).toThrow('Not valid JSON');
  });

  it('throws when given neither an array nor a findings object', () => {
    expect(() => parseReviewFindings(JSON.stringify({ foo: 'bar' }))).toThrow(
      'Expected a JSON array',
    );
  });

  it('throws on an empty findings array', () => {
    expect(() => parseReviewFindings(JSON.stringify([]))).toThrow('No findings to add');
  });

  it('throws when a finding has no text field', () => {
    expect(() => parseReviewFindings(JSON.stringify([{ file: 'a.ts' }]))).toThrow(
      'Finding 1 has no description/title/summary',
    );
  });
});
