import { describe, expect, it } from 'vitest';
import { splitQuestionText } from './decision-text';

describe('splitQuestionText', () => {
  it('splits a phase-context lead-in from the bare question', () => {
    const result = splitQuestionText('Phase 2: wiring auth needs a decision: which provider?');
    expect(result).toEqual({ phaseLine: 'Phase 2: wiring auth', question: 'which provider?' });
  });

  it('strips a trailing dash or em-dash left on the phase line', () => {
    expect(splitQuestionText('Phase 2 - needs a decision: which provider?').phaseLine).toBe(
      'Phase 2',
    );
    expect(splitQuestionText('Phase 2 — needs a decision: which provider?').phaseLine).toBe(
      'Phase 2',
    );
  });

  it('returns no phaseLine when the marker starts the text', () => {
    const result = splitQuestionText('needs a decision: which provider?');
    expect(result).toEqual({ phaseLine: undefined, question: 'which provider?' });
  });

  it('falls back to the whole text as the question when there is no marker', () => {
    const result = splitQuestionText('Just a plain question with no marker.');
    expect(result).toEqual({ question: 'Just a plain question with no marker.' });
  });

  it('matches the last occurrence of the marker when it appears more than once', () => {
    const result = splitQuestionText(
      'needs a decision: pick a name — needs a decision: which one exactly?',
    );
    expect(result).toEqual({
      phaseLine: 'needs a decision: pick a name',
      question: 'which one exactly?',
    });
  });
});
