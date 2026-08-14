import { describe, expect, it } from 'vitest';
import { parsePrReviewResult } from './pr-review-settle';

describe('parsePrReviewResult', () => {
  it('parses a clean verdict with findings', () => {
    const result = parsePrReviewResult([
      JSON.stringify({
        verdict: 'comment',
        assessment: 'One nit, otherwise solid.',
        concerns: [],
        findings: [{ path: 'src/a.ts', line: 3, body: 'consider a guard here' }],
      }),
    ]);
    expect(result).toEqual({
      verdict: 'comment',
      assessment: 'One nit, otherwise solid.',
      concerns: [],
      findings: [{ path: 'src/a.ts', line: 3, body: 'consider a guard here' }],
    });
  });

  it('parses a clean verdict with no findings', () => {
    const result = parsePrReviewResult([
      JSON.stringify({ verdict: 'approve', assessment: 'Looks good.', concerns: [], findings: [] }),
    ]);
    expect(result).toEqual({
      verdict: 'approve',
      assessment: 'Looks good.',
      concerns: [],
      findings: [],
    });
  });

  it('parses concerns bullets', () => {
    const verdict = {
      verdict: 'request-changes',
      assessment: 'Mostly fine.',
      concerns: ['Missing a guard on the empty-state path'],
      findings: [],
    };
    expect(parsePrReviewResult([JSON.stringify(verdict)])).toEqual(verdict);
  });

  it('accepts a verdict wrapped in a markdown code fence, scanning from the last line', () => {
    const verdict = { verdict: 'approve', assessment: 'Fine.', concerns: [], findings: [] };
    const lines = ['Reviewed the diff.', '```json', JSON.stringify(verdict), '```'];
    expect(parsePrReviewResult(lines)).toEqual(verdict);
  });

  it('resolves undefined when no JSON line is present', () => {
    expect(parsePrReviewResult(['Just some prose, no verdict.'])).toBeUndefined();
  });

  it('resolves undefined when verdict is missing', () => {
    expect(
      parsePrReviewResult([JSON.stringify({ assessment: 'Fine.', concerns: [], findings: [] })]),
    ).toBeUndefined();
  });

  it('resolves undefined when verdict is not a known value', () => {
    expect(
      parsePrReviewResult([
        JSON.stringify({ verdict: 'reject', assessment: 'Fine.', concerns: [], findings: [] }),
      ]),
    ).toBeUndefined();
  });

  it('resolves undefined when assessment is missing', () => {
    expect(
      parsePrReviewResult([JSON.stringify({ verdict: 'approve', concerns: [], findings: [] })]),
    ).toBeUndefined();
  });

  it('resolves undefined when a finding is missing a required field', () => {
    const missingLine = JSON.stringify({
      verdict: 'comment',
      assessment: 'Has an issue.',
      concerns: [],
      findings: [{ path: 'src/a.ts', body: 'no line number' }],
    });
    expect(parsePrReviewResult([missingLine])).toBeUndefined();
  });

  it('resolves undefined when a finding line is not a positive integer', () => {
    const badLine = JSON.stringify({
      verdict: 'comment',
      assessment: 'Has an issue.',
      concerns: [],
      findings: [{ path: 'src/a.ts', line: 0, body: 'bad line' }],
    });
    expect(parsePrReviewResult([badLine])).toBeUndefined();
  });
});
