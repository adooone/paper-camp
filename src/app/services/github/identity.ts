import { GithubApiError } from './client';

const API_ROOT = 'https://api.github.com';

export interface GithubIdentity {
  login: string;
  avatarUrl: string;
}

async function request(token: string, path: string) {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new GithubApiError(
      body?.message ?? `GitHub API error (${response.status})`,
      response.status,
    );
  }
  return response.json();
}

export async function fetchGithubIdentity(token: string): Promise<GithubIdentity> {
  const body = await request(token, '/user');
  return { login: body.login, avatarUrl: body.avatar_url };
}

export async function fetchAccessibleRepoNames(token: string): Promise<string[]> {
  const names: string[] = [];
  for (let page = 1; ; page++) {
    const body = await request(
      token,
      `/user/repos?per_page=100&affiliation=owner,collaborator&page=${page}`,
    );
    if (!Array.isArray(body) || body.length === 0) break;
    names.push(...body.map((repo: { full_name: string }) => repo.full_name));
    if (body.length < 100) break;
  }
  return names;
}
