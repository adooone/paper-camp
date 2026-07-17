import {
  type SimilarityCandidate,
  type SimilarityMatch,
  type SimilarityOptions,
  scoreIdeaSimilarity,
} from '@/app/features/plans/helpers';
import { useEffect, useMemo, useState } from 'react';

const DEFAULT_DEBOUNCE_MS = 250;

/** Re-scores `debounceMs` after typing settles, so a fast typist doesn't
 * re-run the scorer on every keystroke. */
export function useSimilarIdeas<T extends SimilarityCandidate>(
  text: string,
  candidates: T[],
  options: SimilarityOptions & { debounceMs?: number } = {},
): SimilarityMatch<T>[] {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, ...scoreOptions } = options;
  const [debouncedText, setDebouncedText] = useState(text);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(text), debounceMs);
    return () => clearTimeout(timer);
  }, [text, debounceMs]);

  const { threshold, limit } = scoreOptions;
  return useMemo(
    () => scoreIdeaSimilarity(debouncedText, candidates, { threshold, limit }),
    [debouncedText, candidates, threshold, limit],
  );
}
