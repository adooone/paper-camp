import { describe, expect, it } from 'vitest';
import { parseNightCheckFindings, parseNightConfirmVerdict } from './night-findings';

describe('parseNightCheckFindings', () => {
  it('parses a well-formed findings array', () => {
    const text = '[{"file": "src/a.ts", "line": 10, "message": "off by one"}]';
    expect(parseNightCheckFindings(text)).toEqual([
      { file: 'src/a.ts', line: 10, message: 'off by one' },
    ]);
  });

  it('parses an empty array as no findings', () => {
    expect(parseNightCheckFindings('[]')).toEqual([]);
  });

  it('defaults a missing or non-numeric line to null', () => {
    const text = '[{"file": "src/a.ts", "message": "no line given"}]';
    expect(parseNightCheckFindings(text)).toEqual([
      { file: 'src/a.ts', line: null, message: 'no line given' },
    ]);
  });

  it('extracts JSON wrapped in prose or a code fence', () => {
    const text = 'Here you go:\n```json\n[{"file": "a.ts", "line": 1, "message": "m"}]\n```\nDone.';
    expect(parseNightCheckFindings(text)).toEqual([{ file: 'a.ts', line: 1, message: 'm' }]);
  });

  it('is undefined for text with no JSON array', () => {
    expect(parseNightCheckFindings('no findings here')).toBeUndefined();
  });

  it('is undefined when an entry is missing a required field', () => {
    expect(parseNightCheckFindings('[{"file": "a.ts"}]')).toBeUndefined();
  });

  it('is undefined for malformed JSON', () => {
    expect(parseNightCheckFindings('[{"file": "a.ts", "message": }]')).toBeUndefined();
  });
});

describe('parseNightConfirmVerdict', () => {
  it('parses a confirmed verdict with severity', () => {
    const text = '{"confirmed": true, "severity": "high", "reasoning": "checked it"}';
    expect(parseNightConfirmVerdict(text)).toEqual({
      confirmed: true,
      severity: 'high',
      reasoning: 'checked it',
    });
  });

  it('parses a rejected verdict, ignoring any severity given', () => {
    const text = '{"confirmed": false, "severity": null, "reasoning": "false positive"}';
    expect(parseNightConfirmVerdict(text)).toEqual({
      confirmed: false,
      severity: null,
      reasoning: 'false positive',
    });
  });

  it('is undefined when confirmed is true but severity is not one of the rubric values', () => {
    const text = '{"confirmed": true, "severity": "urgent", "reasoning": "x"}';
    expect(parseNightConfirmVerdict(text)).toBeUndefined();
  });

  it('is undefined for text with no JSON object', () => {
    expect(parseNightConfirmVerdict('nothing to see here')).toBeUndefined();
  });

  it('defaults reasoning to an empty string when absent', () => {
    const text = '{"confirmed": false}';
    expect(parseNightConfirmVerdict(text)).toEqual({
      confirmed: false,
      severity: null,
      reasoning: '',
    });
  });
});
