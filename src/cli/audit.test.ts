import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { parseEntityFile } from '../core/parse';
import { computePlanContentHash } from '../core/serialize';
import { runAudit } from './index';

// `runAudit` still spawns the configured agent binary (default "opencode", see
// DEFAULT_AGENTS.phase in src/types/index.ts) — a shim binary of that name is put first
// on PATH so the test never shells out to a real, network-calling AI agent.

const PLAN_REVIEW = `---
id: IDEA-1
title: Test plan
type: feat
status: review
created: 2026-07-01
---
Plan body.

### Phases
- [x] First phase
- [ ] Second phase
`;

function withAuditStamp(md: string, hash: string, date = '2026-07-01'): string {
  return md.replace(
    'created: 2026-07-01\n',
    `created: 2026-07-01\naudited: ${date}\naudited-hash: ${hash}\n`,
  );
}

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeProject(planMd: string): Promise<{ root: string; planFile: string }> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-cli-audit-'));
  dirs.push(root);
  const shimBin = join(root, 'shim-bin');
  await mkdir(shimBin, { recursive: true });
  // A no-op "opencode" that exits 0 without touching the plan file, standing in for
  // an agent run that made no changes (the [done]/gapPhases=0 case).
  const shimPath = join(shimBin, 'opencode');
  await writeFile(shimPath, '#!/usr/bin/env node\nprocess.exit(0);\n');
  await chmod(shimPath, 0o755);

  const ideasDir = join(root, 'papercamp', 'ideas');
  await mkdir(ideasDir, { recursive: true });
  const planFile = join(ideasDir, 'IDEA-1.md');
  await writeFile(planFile, planMd);

  return { root, planFile };
}

async function withShimOnPath<T>(root: string, fn: () => Promise<T>): Promise<T> {
  const shimBin = join(root, 'shim-bin');
  const originalPath = process.env.PATH;
  process.env.PATH = `${shimBin}:${originalPath}`;
  try {
    return await fn();
  } finally {
    process.env.PATH = originalPath;
  }
}

function captureLogs() {
  const lines: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    lines.push(args.join(' '));
  });
  return {
    get output() {
      return lines.join('\n');
    },
    restore() {
      logSpy.mockRestore();
    },
  };
}

describe('runAudit', () => {
  it('skips a plan whose audited-hash still matches its content, without invoking an agent', async () => {
    const { body, phases } = parseEntityFile(PLAN_REVIEW).entries[0];
    const hash = computePlanContentHash({ body, phases });
    const { root, planFile } = await makeProject(withAuditStamp(PLAN_REVIEW, hash));

    const logs = captureLogs();
    const ok = await withShimOnPath(root, () => runAudit(root));
    logs.restore();

    expect(ok).toBe(true);
    expect(logs.output).toContain('[skip]');
    expect(logs.output).toContain('unchanged');
    expect(logs.output).toContain('Audited : 0   Skipped : 1   Failed : 0');
    // Untouched — no stamp rewrite happened for a skipped plan.
    expect(await readFile(planFile, 'utf-8')).toContain(`audited-hash: ${hash}`);
  });

  it('re-audits and re-stamps a plan whose content changed since its audited-hash was set', async () => {
    const { root, planFile } = await makeProject(
      withAuditStamp(PLAN_REVIEW, 'stale-hash-does-not-match'),
    );

    const logs = captureLogs();
    const ok = await withShimOnPath(root, () => runAudit(root));
    logs.restore();

    expect(ok).toBe(true);
    expect(logs.output).toContain('[audit]');
    expect(logs.output).toContain('[done]');
    expect(logs.output).toContain('Audited : 1   Skipped : 0   Failed : 0');

    const after = parseEntityFile(await readFile(planFile, 'utf-8')).entries[0];
    const expectedHash = computePlanContentHash({ body: after.body, phases: after.phases });
    expect(after.auditedHash).toBe(expectedHash);
    expect(after.auditedHash).not.toBe('stale-hash-does-not-match');
  });

  it('audits a plan that has never been audited, stamping audited-hash for the first time', async () => {
    const { root, planFile } = await makeProject(PLAN_REVIEW);

    const logs = captureLogs();
    const ok = await withShimOnPath(root, () => runAudit(root));
    logs.restore();

    expect(ok).toBe(true);
    expect(logs.output).not.toContain('[skip]');
    expect(logs.output).toContain('[done]');

    const after = parseEntityFile(await readFile(planFile, 'utf-8')).entries[0];
    expect(after.auditedHash).toBeTruthy();
  });
});
