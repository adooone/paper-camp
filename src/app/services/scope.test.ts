import { describe, expect, it } from 'vitest';
import {
  parseScopeKey,
  parseScopeParam,
  resolveScope,
  scopeKey,
  serializeScopeParam,
} from './scope';

describe('scopeKey / parseScopeKey', () => {
  it('joins and splits slug and machine on @', () => {
    expect(scopeKey('folk-ui', 'deimos')).toBe('folk-ui@deimos');
    expect(parseScopeKey('folk-ui@deimos')).toEqual({ slug: 'folk-ui', machine: 'deimos' });
  });

  it('is null for a key with no @, or an empty slug or machine', () => {
    expect(parseScopeKey('folk-ui')).toBeNull();
    expect(parseScopeKey('@deimos')).toBeNull();
    expect(parseScopeKey('folk-ui@')).toBeNull();
  });
});

describe('parseScopeParam / serializeScopeParam', () => {
  it('is empty for an absent or blank param', () => {
    expect(parseScopeParam(undefined)).toEqual([]);
    expect(parseScopeParam('')).toEqual([]);
  });

  it('splits on comma, trims, drops blanks, and dedupes', () => {
    expect(parseScopeParam('paper-camp@deimos, folk-ui@deimos ,,paper-camp@deimos')).toEqual([
      'paper-camp@deimos',
      'folk-ui@deimos',
    ]);
  });

  it('serializes back to a comma-joined string, undefined when empty', () => {
    expect(serializeScopeParam(['paper-camp@deimos', 'folk-ui@deimos'])).toBe(
      'paper-camp@deimos,folk-ui@deimos',
    );
    expect(serializeScopeParam([])).toBeUndefined();
  });
});

describe('resolveScope', () => {
  it('is just the current project with nothing requested', () => {
    expect(resolveScope('paper-camp@deimos', [])).toEqual(['paper-camp@deimos']);
  });

  it('puts the current project first and appends the rest, deduped', () => {
    expect(
      resolveScope('paper-camp@deimos', ['folk-ui@deimos', 'paper-camp@deimos', 'folk-ui@deimos']),
    ).toEqual(['paper-camp@deimos', 'folk-ui@deimos']);
  });
});
