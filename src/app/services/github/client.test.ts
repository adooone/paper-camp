import { afterEach, describe, expect, it, vi } from 'vitest';
import { GithubApiError, deleteFile, getFile, listDir, putFile } from './client';
import type { GithubCorpusConfig } from './config-store';

const config: GithubCorpusConfig = { owner: 'acme', repo: 'widgets', token: 'ghp_x' };

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('github client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getFile decodes base64 content and returns the sha', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { content: btoa('hello world'), sha: 'abc123' }));
    vi.stubGlobal('fetch', fetchMock);

    const file = await getFile(config, 'papercamp/ideas/IDEA-1.md');
    expect(file).toEqual({ content: 'hello world', sha: 'abc123' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.github.com/repos/acme/widgets/contents/papercamp/ideas/IDEA-1.md',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ghp_x');
  });

  it('getFile returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { message: 'Not Found' })));
    expect(await getFile(config, 'missing.md')).toBeNull();
  });

  it('getFile round-trips non-ASCII content', async () => {
    const original = 'héllo — wörld';
    const bytes = new TextEncoder().encode(original);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { content: btoa(binary), sha: 's' })),
    );
    const file = await getFile(config, 'a.md');
    expect(file?.content).toBe(original);
  });

  it('throws GithubApiError with the response message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(403, { message: 'Bad credentials' })),
    );
    await expect(getFile(config, 'a.md')).rejects.toThrow(GithubApiError);
    await expect(getFile(config, 'a.md')).rejects.toThrow('Bad credentials');
  });

  it('listDir returns file entries for a directory listing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, [
          { name: 'IDEA-1.md', type: 'file' },
          { name: 'archive', type: 'dir' },
        ]),
      ),
    );
    expect(await listDir(config, 'papercamp/ideas')).toEqual([
      { name: 'IDEA-1.md', type: 'file' },
      { name: 'archive', type: 'dir' },
    ]);
  });

  it('listDir returns an empty list for a 404 (dir does not exist yet)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { message: 'Not Found' })));
    expect(await listDir(config, 'papercamp/ideas/archive')).toEqual([]);
  });

  it('putFile base64-encodes the content and sends the sha when updating', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { content: { sha: 'new-sha' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await putFile(config, 'a.md', 'hello', 'commit message', 'old-sha');
    expect(result).toEqual({ sha: 'new-sha' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ message: 'commit message', content: btoa('hello'), sha: 'old-sha' });
  });

  it('putFile omits sha when creating a new file', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { content: { sha: 's' } }));
    vi.stubGlobal('fetch', fetchMock);

    await putFile(config, 'a.md', 'hello', 'commit message');
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty('sha');
  });

  it('deleteFile sends a DELETE with the sha', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);

    await deleteFile(config, 'a.md', 'sha-1', 'archive a.md');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'archive a.md', sha: 'sha-1' });
  });
});
