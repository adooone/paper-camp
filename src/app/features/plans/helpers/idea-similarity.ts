/** Deliberately AI-free: the ~45-idea corpus is small enough that scoring
 * shared tokens is enough to surface plausible duplicates. */

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

const DEFAULT_SIMILARITY_THRESHOLD = 0.2;
const DEFAULT_SIMILARITY_LIMIT = 5;

// A shared word in the title/tags is a stronger duplicate signal than one buried in prose.
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
