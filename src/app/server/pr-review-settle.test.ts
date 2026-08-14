import { describe, expect, it } from 'vitest';
import { parsePrReviewResult } from './pr-review-settle';

describe('parsePrReviewResult', () => {
  it('parses a clean verdict with findings', () => {
    const result = parsePrReviewResult([
      JSON.stringify({
        summary: 'One nit, otherwise solid.',
        findings: [{ path: 'src/a.ts', line: 3, body: 'consider a guard here' }],
      }),
    ]);
    expect(result).toEqual({
      summary: 'One nit, otherwise solid.',
      findings: [{ path: 'src/a.ts', line: 3, body: 'consider a guard here' }],
    });
  });

  it('parses a clean verdict with no findings', () => {
    const result = parsePrReviewResult([JSON.stringify({ summary: 'Looks good.', findings: [] })]);
    expect(result).toEqual({ summary: 'Looks good.', findings: [] });
  });

  it('accepts a verdict wrapped in a markdown code fence, scanning from the last line', () => {
    const verdict = { summary: 'Fine.', findings: [] };
    const lines = ['Reviewed the diff.', '```json', JSON.stringify(verdict), '```'];
    expect(parsePrReviewResult(lines)).toEqual(verdict);
  });

  it('resolves undefined when no JSON line is present', () => {
    expect(parsePrReviewResult(['Just some prose, no verdict.'])).toBeUndefined();
  });

  it('resolves undefined when summary is missing', () => {
    expect(parsePrReviewResult([JSON.stringify({ findings: [] })])).toBeUndefined();
  });

  it('resolves undefined when a finding is missing a required field', () => {
    const missingLine = JSON.stringify({
      summary: 'Has an issue.',
      findings: [{ path: 'src/a.ts', body: 'no line number' }],
    });
    expect(parsePrReviewResult([missingLine])).toBeUndefined();
  });

  it('resolves undefined when a finding line is not a positive integer', () => {
    const badLine = JSON.stringify({
      summary: 'Has an issue.',
      findings: [{ path: 'src/a.ts', line: 0, body: 'bad line' }],
    });
    expect(parsePrReviewResult([badLine])).toBeUndefined();
  });
});
