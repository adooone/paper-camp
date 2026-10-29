import type { AssetEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { assetKind, assetMarkdownLink, formatFileSize, parseAssetUrl } from '../helpers';

const asset = (name: string, type: string): AssetEntry => ({
  name,
  type,
  size: 0,
  modified: '2026-10-29T00:00:00.000Z',
});

describe('assetKind', () => {
  it('treats any image mime, including svg, as an image', () => {
    expect(assetKind(asset('shot.png', 'image/png'))).toBe('image');
    expect(assetKind(asset('diagram.svg', 'image/svg+xml'))).toBe('image');
  });

  it('treats text/html as html, not text', () => {
    expect(assetKind(asset('mockups.html', 'text/html'))).toBe('html');
  });

  it('treats plain text and json as text', () => {
    expect(assetKind(asset('notes.txt', 'text/plain'))).toBe('text');
    expect(assetKind(asset('data.json', 'application/json'))).toBe('text');
  });

  it('falls back to other for an unrecognised mime', () => {
    expect(assetKind(asset('report.pdf', 'application/pdf'))).toBe('other');
  });
});

describe('formatFileSize', () => {
  it.each([
    [42, '42 B'],
    [2048, '2.0 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});

describe('assetMarkdownLink', () => {
  it('writes an image link as a markdown image', () => {
    expect(assetMarkdownLink(asset('shot.png', 'image/png'))).toBe('![shot.png](assets/shot.png)');
  });

  it('writes a non-image link as a plain markdown link', () => {
    expect(assetMarkdownLink(asset('mockups.html', 'text/html'))).toBe(
      '[mockups.html](assets/mockups.html)',
    );
  });
});

describe('parseAssetUrl', () => {
  it('extracts id and name from the asset route', () => {
    expect(parseAssetUrl('/api/ideas/asset?id=IDEA-321&name=mockups.html')).toEqual({
      id: 'IDEA-321',
      name: 'mockups.html',
    });
  });

  it('returns null when either param is missing', () => {
    expect(parseAssetUrl('/api/ideas/asset?id=IDEA-321')).toBeNull();
  });
});
