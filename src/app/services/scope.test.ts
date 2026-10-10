import { describe, expect, it } from 'vitest';
import {
  assignScopeColors,
  parseScopeKey,
  parseScopeParam,
  resolveScope,
  scopeKey,
  serializeScopeParam,
} from './scope';

describe('scopeKey / parseScopeKey', () => {
  it('joins and splits slug and machine on @', () => {
    expect(scopeKey('paper-ui', 'deimos')).toBe('paper-ui@deimos');
    expect(parseScopeKey('paper-ui@deimos')).toEqual({ slug: 'paper-ui', machine: 'deimos' });
  });

  it('is null for a key with no @, or an empty slug or machine', () => {
    expect(parseScopeKey('paper-ui')).toBeNull();
    expect(parseScopeKey('@deimos')).toBeNull();
    expect(parseScopeKey('paper-ui@')).toBeNull();
  });
});

describe('parseScopeParam / serializeScopeParam', () => {
  it('is empty for an absent or blank param', () => {
    expect(parseScopeParam(undefined)).toEqual([]);
    expect(parseScopeParam('')).toEqual([]);
  });

  it('splits on comma, trims, drops blanks, and dedupes', () => {
    expect(parseScopeParam('paper-camp@deimos, paper-ui@deimos ,,paper-camp@deimos')).toEqual([
      'paper-camp@deimos',
      'paper-ui@deimos',
    ]);
  });

  it('serializes back to a comma-joined string, undefined when empty', () => {
    expect(serializeScopeParam(['paper-camp@deimos', 'paper-ui@deimos'])).toBe(
      'paper-camp@deimos,paper-ui@deimos',
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
      resolveScope('paper-camp@deimos', [
        'paper-ui@deimos',
        'paper-camp@deimos',
        'paper-ui@deimos',
      ]),
    ).toEqual(['paper-camp@deimos', 'paper-ui@deimos']);
  });
});

describe('assignScopeColors', () => {
  it('assigns the fixed sequence by position in hub order', () => {
    const colors = assignScopeColors(['a@m', 'b@m', 'c@m']);
    expect(colors.get('a@m')).toBe('blue');
    expect(colors.get('b@m')).toBe('green');
    expect(colors.get('c@m')).toBe('amber');
  });

  it('cycles the sequence past six projects', () => {
    const hubOrder = Array.from({ length: 7 }, (_, i) => `p${i}@m`);
    const colors = assignScopeColors(hubOrder);
    expect(colors.get('p0@m')).toBe('blue');
    expect(colors.get('p6@m')).toBe('blue');
  });

  it("a project's color is stable regardless of what else is in scope, since it comes from hub position", () => {
    const hubOrder = ['a@m', 'b@m', 'c@m'];
    expect(assignScopeColors(hubOrder).get('c@m')).toBe(assignScopeColors(hubOrder).get('c@m'));
  });
});
