import { describe, expect, it } from 'vitest';
import { type SimilarityCandidate, scoreIdeaSimilarity } from './idea-similarity';

const candidate = (overrides: Partial<SimilarityCandidate>): SimilarityCandidate => ({
  id: 'IDEA-1',
  title: 'Untitled',
  body: '',
  tags: [],
  ...overrides,
});

describe('scoreIdeaSimilarity', () => {
  it('returns nothing for an empty query', () => {
    const candidates = [candidate({ title: 'Build the Stack panel' })];
    expect(scoreIdeaSimilarity('', candidates)).toEqual([]);
    expect(scoreIdeaSimilarity('   ', candidates)).toEqual([]);
  });

  it('returns nothing when there are no candidates', () => {
    expect(scoreIdeaSimilarity('Build the Stack panel', [])).toEqual([]);
  });

  it('ranks a title match above a body-only match', () => {
    const titleMatch = candidate({ id: 'IDEA-1', title: 'Check idea overlap at capture' });
    const bodyMatch = candidate({
      id: 'IDEA-2',
      title: 'Something unrelated',
      body: 'This idea touches overlap and capture in passing.',
    });
    const matches = scoreIdeaSimilarity('overlap capture', [bodyMatch, titleMatch], {
      threshold: 0,
    });
    expect(matches.map((m) => m.candidate.id)).toEqual(['IDEA-1', 'IDEA-2']);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });

  it('counts a shared tag toward the score', () => {
    const tagged = candidate({ id: 'IDEA-1', title: 'Other title', tags: ['overlap'] });
    const matches = scoreIdeaSimilarity('overlap', [tagged], { threshold: 0 });
    expect(matches[0].score).toBeGreaterThan(0);
  });

  it('excludes candidates below the threshold', () => {
    const weak = candidate({ id: 'IDEA-1', title: 'Completely different topic' });
    const matches = scoreIdeaSimilarity('overlap capture idea', [weak], { threshold: 0.5 });
    expect(matches).toEqual([]);
  });

  it('is case-insensitive and ignores stray punctuation', () => {
    const match = candidate({ id: 'IDEA-1', title: 'Check Idea Overlap!' });
    const matches = scoreIdeaSimilarity('idea overlap', [match], { threshold: 0 });
    expect(matches).toHaveLength(1);
  });

  it('sorts by descending score and respects limit', () => {
    const strong = candidate({ id: 'IDEA-1', title: 'idea overlap capture idea' });
    const medium = candidate({ id: 'IDEA-2', title: 'idea capture' });
    const weak = candidate({ id: 'IDEA-3', title: 'idea' });
    const matches = scoreIdeaSimilarity('idea overlap capture', [weak, strong, medium], {
      threshold: 0,
      limit: 2,
    });
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.candidate.id)).toEqual(['IDEA-1', 'IDEA-2']);
  });

  it('ignores common stopwords in the query', () => {
    const match = candidate({ id: 'IDEA-1', title: 'Build the docs page' });
    const matches = scoreIdeaSimilarity('the and or of', [match], { threshold: 0 });
    expect(matches).toEqual([]);
  });
});
