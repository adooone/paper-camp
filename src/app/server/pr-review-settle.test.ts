import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PrReviewResult } from '@/types/index';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parsePrReviewResult,
  postPrReview,
  renderReviewGithubBody,
  renderReviewThreadMessage,
} from './pr-review-settle';

const gitPr = vi.hoisted(() => ({
  dispatchPrReview: vi.fn(),
  createPrReview: vi.fn(),
  scoutReviewFooter: (entityId: string, sha: string) =>
    `Paper Scout · ${entityId} · ${sha.slice(0, 7)}`,
}));
vi.mock('@/core/git-pr', () => gitPr);

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

describe('postPrReview', () => {
  const roots: string[] = [];

  afterEach(async () => {
    gitPr.dispatchPrReview.mockReset();
    gitPr.createPrReview.mockReset();
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function makeRoot() {
    const root = await mkdtemp(join(tmpdir(), 'papercamp-pr-review-settle-'));
    roots.push(root);
    await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
    await writeFile(
      join(root, 'papercamp', 'ideas', 'IDEA-170.md'),
      '---\nid: IDEA-170\ntitle: Test idea\ntype: feat\nstatus: in-progress\ncreated: 2026-07-01\n---\nBody.\n',
    );
    return root;
  }

  const result: PrReviewResult = {
    verdict: 'comment',
    assessment: 'Looks fine.',
    concerns: [],
    findings: [{ path: 'a.ts', line: 1, body: 'x' }],
  };

  it('reports the dispatch path and skips the direct post when the dispatch succeeds', async () => {
    gitPr.dispatchPrReview.mockResolvedValue({ delivered: true });
    const root = await makeRoot();
    const lines: string[] = [];

    postPrReview(root, 'IDEA-170', 'https://github.com/o/r/pull/7', 'sha1234', result, (line) =>
      lines.push(line),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(gitPr.dispatchPrReview).toHaveBeenCalledTimes(1);
    expect(gitPr.createPrReview).not.toHaveBeenCalled();
    expect(lines[0]).toContain('dispatched to the Scout review workflow (1 finding)');
    expect(lines[0]).toContain('recorded on the idea');
  });

  it('falls back to a direct post and says so when the dispatch fails', async () => {
    gitPr.dispatchPrReview.mockResolvedValue({ delivered: false });
    gitPr.createPrReview.mockResolvedValue({ delivered: true });
    const root = await makeRoot();
    const lines: string[] = [];

    postPrReview(root, 'IDEA-170', 'https://github.com/o/r/pull/7', 'sha1234', result, (line) =>
      lines.push(line),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(gitPr.createPrReview).toHaveBeenCalledTimes(1);
    expect(lines[0]).toContain('posted directly to GitHub, dispatch unavailable (1 finding)');
  });

  it('reports the post as failed when both the dispatch and the direct post fail', async () => {
    gitPr.dispatchPrReview.mockResolvedValue({ delivered: false });
    gitPr.createPrReview.mockResolvedValue({
      delivered: false,
      body: '{"message":"Unprocessable Entity"}',
    });
    const root = await makeRoot();
    const lines: string[] = [];

    postPrReview(root, 'IDEA-170', 'https://github.com/o/r/pull/7', 'sha1234', result, (line) =>
      lines.push(line),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(lines[0]).toContain('GitHub post failed');
    expect(lines[0]).toContain('Unprocessable Entity');
  });

  it('caps findings sent in the dispatch and notes the drop in the rendered body, but sends every finding on the direct-post fallback', async () => {
    const manyFindings = Array.from({ length: 25 }, (_, i) => ({
      path: `f${i}.ts`,
      line: i + 1,
      body: `finding ${i}`,
    }));
    const many: PrReviewResult = { ...result, findings: manyFindings };

    gitPr.dispatchPrReview.mockResolvedValue({ delivered: true });
    const root = await makeRoot();
    postPrReview(root, 'IDEA-170', 'https://github.com/o/r/pull/7', 'sha1234', many, () => {});
    await new Promise((resolve) => setTimeout(resolve, 50));

    const dispatchCall = gitPr.dispatchPrReview.mock.calls[0][2];
    expect(dispatchCall.comments).toHaveLength(20);
    expect(dispatchCall.body).toContain("5 findings omitted to fit the review's size limit.");

    gitPr.dispatchPrReview.mockReset();
    gitPr.dispatchPrReview.mockResolvedValue({ delivered: false });
    gitPr.createPrReview.mockResolvedValue({ delivered: true });
    const root2 = await makeRoot();
    postPrReview(root2, 'IDEA-170', 'https://github.com/o/r/pull/7', 'sha1234', many, () => {});
    await new Promise((resolve) => setTimeout(resolve, 50));

    const directCall = gitPr.createPrReview.mock.calls[0][2];
    expect(directCall.comments).toHaveLength(25);
    expect(directCall.body).not.toContain('omitted');
  });

  it('degrades to a summary-only post when GitHub rejects a comment line with a 422', async () => {
    gitPr.dispatchPrReview.mockResolvedValue({ delivered: false });
    gitPr.createPrReview
      .mockResolvedValueOnce({
        delivered: false,
        body: 'gh: Validation Failed (HTTP 422)\nline must be part of the diff',
      })
      .mockResolvedValueOnce({ delivered: true });
    const root = await makeRoot();
    const lines: string[] = [];

    postPrReview(root, 'IDEA-170', 'https://github.com/o/r/pull/7', 'sha1234', result, (line) =>
      lines.push(line),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(gitPr.createPrReview).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = gitPr.createPrReview.mock.calls;
    expect(firstCall[2].comments).toHaveLength(1);
    expect(secondCall[2].comments).toEqual([]);
    expect(secondCall[2].body).toContain('1 finding omitted — GitHub rejected the line');
    expect(lines[0]).toContain(
      'posted directly to GitHub, dispatch unavailable (0 findings, 1 dropped — invalid line)',
    );
  });

  it('does not retry a direct-post failure that is not a 422', async () => {
    gitPr.dispatchPrReview.mockResolvedValue({ delivered: false });
    gitPr.createPrReview.mockResolvedValue({ delivered: false, body: 'gh: connection reset' });
    const root = await makeRoot();
    const lines: string[] = [];

    postPrReview(root, 'IDEA-170', 'https://github.com/o/r/pull/7', 'sha1234', result, (line) =>
      lines.push(line),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(gitPr.createPrReview).toHaveBeenCalledTimes(1);
    expect(lines[0]).toContain('GitHub post failed');
  });

  it('records the rendered thread message on the idea file', async () => {
    gitPr.dispatchPrReview.mockResolvedValue({ delivered: true });
    const root = await makeRoot();

    postPrReview(root, 'IDEA-170', 'https://github.com/o/r/pull/7', 'sha1234', result, () => {});
    await new Promise((resolve) => setTimeout(resolve, 50));

    const raw = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-170.md'), 'utf-8');
    expect(raw).toContain(renderReviewThreadMessage(result));
  });
});
