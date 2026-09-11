import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface CommitConvention {
  types: string[];
  scopes: string[] | null;
  scopeRequired: boolean;
}

const CONVENTIONAL_TYPES = [
  'feat',
  'fix',
  'chore',
  'docs',
  'refactor',
  'style',
  'test',
  'perf',
  'build',
  'ci',
  'revert',
];

export const DEFAULT_COMMIT_CONVENTION: CommitConvention = {
  types: CONVENTIONAL_TYPES,
  scopes: null,
  scopeRequired: false,
};

type Rule = [number, string, unknown] | undefined;

function enumRule(rule: Rule): string[] | null {
  if (!rule || rule[0] === 0 || !Array.isArray(rule[2])) return null;
  return rule[2].filter((value): value is string => typeof value === 'string');
}

/** The repo's own commitlint rules, so a suggested title is checked against what the
 *  commit-msg hook will actually enforce; a repo without the file gets the
 *  conventional defaults. */
export async function readCommitConvention(root: string): Promise<CommitConvention> {
  const raw = await readFile(join(root, '.commitlintrc.json'), 'utf-8').catch(() => null);
  if (!raw) return DEFAULT_COMMIT_CONVENTION;
  try {
    const rules = ((JSON.parse(raw) as { rules?: Record<string, Rule> }).rules ?? {}) as Record<
      string,
      Rule
    >;
    const scopeEmpty = rules['scope-empty'];
    return {
      types: enumRule(rules['type-enum']) ?? CONVENTIONAL_TYPES,
      scopes: enumRule(rules['scope-enum']),
      scopeRequired: Boolean(scopeEmpty && scopeEmpty[0] === 2 && scopeEmpty[1] === 'never'),
    };
  } catch {
    return DEFAULT_COMMIT_CONVENTION;
  }
}

const TITLE_RE = /^([a-z]+)(?:\(([^)]*)\))?(!)?:\s*(.*)$/;

/** Why a title would fail the hook, in one sentence, or null when it passes. */
export function commitTitleViolation(title: string, convention: CommitConvention): string | null {
  const match = title.trim().match(TITLE_RE);
  if (!match) return 'the title must look like `type(scope): subject`';
  const [, type, scope, , subject] = match;
  if (!convention.types.includes(type)) {
    return `type "${type}" is not allowed; use one of ${convention.types.join(', ')}`;
  }
  if (!scope) {
    if (convention.scopeRequired) {
      return `a scope is required${convention.scopes ? `; use one of ${convention.scopes.join(', ')}` : ''}`;
    }
  } else if (convention.scopes && !convention.scopes.includes(scope)) {
    return `scope "${scope}" is not allowed; use one of ${convention.scopes.join(', ')}`;
  }
  if (!subject.trim()) return 'the subject may not be empty';
  if (subject.trim().endsWith('.')) return 'the subject may not end with a period';
  if (title.trim().length > 100) return 'the title must be under 100 characters';
  return null;
}
