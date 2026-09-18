import type { NightSuggestionEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { findingFixReason, findingIssueId, findingsIssueId } from './use-finding-fix-task';

const finding = (overrides: Partial<NightSuggestionEntry> = {}): NightSuggestionEntry => ({
  date: '2026-09-18',
  check: 'tests',
  chunk: 'src/app',
  file: 'src/app/features/plans/hooks/use-finding-fix-task.ts',
  line: 12,
  commit: 'f1780a0e12345',
  severity: 'normal',
  message: 'untested behavior change',
  ...overrides,
});

describe('findingIssueId', () => {
  it('keys on date, check, file, and line', () => {
    expect(findingIssueId(finding())).toBe(
      'night-finding:2026-09-18-tests-src/app/features/plans/hooks/use-finding-fix-task.ts-12',
    );
  });
});

describe('findingsIssueId', () => {
  it('uses the single finding id for one finding', () => {
    expect(findingsIssueId([finding()])).toBe(findingIssueId(finding()));
  });

  it('prefixes the chunk id with the date for multiple findings', () => {
    expect(findingsIssueId([finding(), finding({ file: 'other.ts', line: 3 })])).toBe(
      'night-chunk:2026-09-18-src/app',
    );
  });
});

describe('findingFixReason', () => {
  it('includes the file:line location and truncated commit', () => {
    const reason = findingFixReason(finding());
    expect(reason).toContain('src/app/features/plans/hooks/use-finding-fix-task.ts:12');
    expect(reason).toContain('commit f1780a0');
    expect(reason).toContain('check in `src/app`');
  });

  it('omits the line when the finding has none', () => {
    const reason = findingFixReason(finding({ line: null }));
    expect(reason).toContain('src/app/features/plans/hooks/use-finding-fix-task.ts (commit');
  });
});
