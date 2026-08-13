import type { PhaseItem } from '@/types/index';

const COMMIT_PREFIX_RE = /^[a-z]+\([a-z-]+\):\s+/;

/** Inverts deliver-controls.tsx's `deriveSuggestedCommit` assembly
 * (`${kind}(${scope}): ${title}`) so a manual commit's title reads
 * like a phase, not a conventional-commit line. */
export const stripCommitPrefix = (title: string): string => title.replace(COMMIT_PREFIX_RE, '');

export const appendManualPhase = (phases: PhaseItem[], commitTitle: string): PhaseItem[] => [
  ...phases,
  { done: true, text: stripCommitPrefix(commitTitle), source: 'manual' },
];

const CORPUS_PREFIX = 'papercamp/';

/** A commit touching only the corpus is bookkeeping *about* a plan, not work on
 * it — recording it would describe the record rather than any delivery. */
export const isCorpusOnlyCommit = (files: string[]): boolean =>
  files.length > 0 && files.every((file) => file.startsWith(CORPUS_PREFIX));

export const planEntityPath = (planId: string): string => `${CORPUS_PREFIX}ideas/${planId}.md`;
