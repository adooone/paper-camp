import { afterEach, describe, expect, it } from 'vitest';
import { githubClientId } from './device-flow';

describe('githubClientId', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'PAPERCAMP_GITHUB_CLIENT_ID');
  });

  it('defaults to the Paper Scout app client id', () => {
    expect(githubClientId()).toBe('Iv23ligLF1oQlhORSdew');
  });

  it('is overridable for a fork running its own GitHub App', () => {
    process.env.PAPERCAMP_GITHUB_CLIENT_ID = 'Iv23liExampleForkId';
    expect(githubClientId()).toBe('Iv23liExampleForkId');
  });

  it('falls back to the default when the override is blank', () => {
    process.env.PAPERCAMP_GITHUB_CLIENT_ID = '   ';
    expect(githubClientId()).toBe('Iv23ligLF1oQlhORSdew');
  });
});
