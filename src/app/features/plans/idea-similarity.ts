/**
 * Keyword-overlap similarity matcher for IDEA-44's "similar ideas" strip.
 * Deliberately AI-free (Tier 1 in the plan) — the corpus is small enough
 * (~45 ideas) that scoring shared tokens between the typed text and each
 * candidate's title/body/tags is enough to surface plausible duplicates.
 * Pure and framework-free so both capture points (New-idea modal,
 * Quick-plan path) can share it; `useSimilarIdeas` (app/hooks) wraps this
 * with debouncing for live typing.
 */

export interface SimilarityCandidate {
  id: string | null | undefined;
  title: string;
  body: string;
  tags?: string[];
}

export interface SimilarityMatch<T extends SimilarityCandidate = SimilarityCandidate> {
  candidate: T;
  score: number;
}

export interface SimilarityOptions {
  /** Minimum score (0..1) a candidate must reach to be returned. */
  threshold?: number;
  /** Max number of matches returned, highest score first. */
  limit?: number;
}

export const DEFAULT_SIMILARITY_THRESHOLD = 0.2;
export const DEFAULT_SIMILARITY_LIMIT = 5;

// Title/tag matches count for more than a body match: a shared word in the
// title or an explicit tag is a much stronger duplicate signal than one
// buried in prose.
const TITLE_WEIGHT = 3;
const TAG_WEIGHT = 2;
const BODY_WEIGHT = 1;
const TOTAL_WEIGHT = TITLE_WEIGHT + TAG_WEIGHT + BODY_WEIGHT;

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'is',
  'at',
  'with',
  'this',
  'that',
  'it',
  'as',
  'be',
  'by',
  'are',
  'was',
  'were',
  'from',
  'into',
  'so',
  'but',
  'not',
  'its',
]);

const tokenize = (text: string): Set<string> => {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  return new Set(tokens);
};

const overlapCount = (query: Set<string>, field: Set<string>): number => {
  let count = 0;
  for (const token of query) {
    if (field.has(token)) count += 1;
  }
  return count;
};

/**
 * Scores `text` against every candidate's title/body/tags and returns
 * matches above `threshold`, ranked highest-score first, capped at `limit`.
 */
export function scoreIdeaSimilarity<T extends SimilarityCandidate>(
  text: string,
  candidates: T[],
  options: SimilarityOptions = {},
): SimilarityMatch<T>[] {
  const { threshold = DEFAULT_SIMILARITY_THRESHOLD, limit = DEFAULT_SIMILARITY_LIMIT } = options;
  const queryTokens = tokenize(text);
  if (queryTokens.size === 0) return [];

  const matches: SimilarityMatch<T>[] = [];
  for (const candidate of candidates) {
    const titleTokens = tokenize(candidate.title);
    const bodyTokens = tokenize(candidate.body);
    const tagTokens = tokenize((candidate.tags ?? []).join(' '));

    const weighted =
      overlapCount(queryTokens, titleTokens) * TITLE_WEIGHT +
      overlapCount(queryTokens, tagTokens) * TAG_WEIGHT +
      overlapCount(queryTokens, bodyTokens) * BODY_WEIGHT;

    const score = weighted / (queryTokens.size * TOTAL_WEIGHT);
    if (score >= threshold) matches.push({ candidate, score });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}
