import type { PrReviewResult } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  parsePrReviewResult,
  renderReviewGithubBody,
  renderReviewThreadMessage,
} from './pr-review-settle';

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

describe('renderReviewGithubBody', () => {
  const base: PrReviewResult = {
    verdict: 'request-changes',
    assessment: 'Spec conformance is solid. The trigger adds a gate the spec never listed.',
    concerns: [
      'A computed review is lost permanently if the post fails',
      'The verdict parser only handles single-line JSON',
    ],
    findings: [
      { path: 'a.ts', line: 1, body: 'x' },
      { path: 'b.ts', line: 2, body: 'y' },
      { path: 'c.ts', line: 3, body: 'z' },
    ],
  };

  it('renders the verdict line, assessment, concerns, and footer', () => {
    const body = renderReviewGithubBody(base, { ideaId: 'IDEA-170', sha: '8e63279abc' });
    expect(body).toBe(
      [
        '**Requests changes** · 3 findings',
        '',
        base.assessment,
        '',
        '**Concerns**',
        '- A computed review is lost permanently if the post fails',
        '- The verdict parser only handles single-line JSON',
        '',
        '<sub>Paper Scout · IDEA-170 · 8e63279</sub>',
      ].join('\n'),
    );
  });

  it('omits the Concerns heading entirely for a clean diff', () => {
    const clean: PrReviewResult = { ...base, verdict: 'approve', concerns: [], findings: [] };
    const body = renderReviewGithubBody(clean, { ideaId: 'IDEA-170', sha: '8e63279' });
    expect(body).not.toContain('Concerns');
    expect(body).toBe(
      [
        '**Approves** · 0 findings',
        '',
        clean.assessment,
        '',
        '<sub>Paper Scout · IDEA-170 · 8e63279</sub>',
      ].join('\n'),
    );
  });

  it('notes dropped findings without truncating silently', () => {
    const body = renderReviewGithubBody(
      { ...base, concerns: [] },
      { ideaId: 'IDEA-170', sha: '8e63279', droppedFindings: 2 },
    );
    expect(body).toContain("_2 findings omitted to fit the review's size limit._");
  });

  it('uses singular "finding" for a single finding and a single dropped finding', () => {
    const one: PrReviewResult = { ...base, concerns: [], findings: [base.findings[0]] };
    const body = renderReviewGithubBody(one, {
      ideaId: 'IDEA-170',
      sha: '8e63279',
      droppedFindings: 1,
    });
    expect(body).toContain('· 1 finding\n');
    expect(body).toContain('_1 finding omitted');
  });
});

describe('renderReviewThreadMessage', () => {
  it('is a single line with verdict, count, and assessment — no bullets, no footer', () => {
    const result: PrReviewResult = {
      verdict: 'comment',
      assessment: 'Looks good, one nit.',
      concerns: ['Something worth flagging'],
      findings: [{ path: 'a.ts', line: 1, body: 'x' }],
    };
    const message = renderReviewThreadMessage(result);
    expect(message).toBe('Comments · 1 finding — Looks good, one nit.');
    expect(message).not.toContain('\n');
    expect(message).not.toContain('<sub>');
    expect(message).not.toContain('- ');
  });
});
