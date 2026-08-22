import { afterEach, describe, expect, it, vi } from 'vitest';
import { GithubApiError } from './client';
import { fetchAccessibleRepoNames, fetchGithubIdentity } from './identity';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('github identity', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchGithubIdentity reads the connected login and avatar', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { login: 'octocat', avatar_url: 'https://x/a.png' }));
    vi.stubGlobal('fetch', fetchMock);

    const identity = await fetchGithubIdentity('ghp_x');
    expect(identity).toEqual({ login: 'octocat', avatarUrl: 'https://x/a.png' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/user');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ghp_x');
  });

  it('fetchGithubIdentity throws GithubApiError with the response message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Bad credentials' })),
    );
    await expect(fetchGithubIdentity('bad')).rejects.toThrow(GithubApiError);
    await expect(fetchGithubIdentity('bad')).rejects.toThrow('Bad credentials');
  });

  it('fetchAccessibleRepoNames returns each reachable repo full name', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, [{ full_name: 'acme/widgets' }, { full_name: 'acme/gadgets' }]),
        ),
    );
    expect(await fetchAccessibleRepoNames('ghp_x')).toEqual(['acme/widgets', 'acme/gadgets']);
  });

  it('fetchAccessibleRepoNames tolerates an unexpected response shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { message: 'nope' })));
    expect(await fetchAccessibleRepoNames('ghp_x')).toEqual([]);
  });
});
