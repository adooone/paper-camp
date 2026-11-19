import { describe, expect, it } from 'vitest';
import { CLASSIC_DESK_PATH, deskUrl, NEXT_DESK_PATH } from './desk-links';

const local = { runtimeUrl: '', pairingToken: null };
const hosted = { runtimeUrl: 'https://deimos.example/p/camp', pairingToken: 'secret' };

describe('deskUrl', () => {
  it('opens the other desk on the same origin when this one serves itself', () => {
    expect(deskUrl(NEXT_DESK_PATH, '', local)).toBe('/next/');
    expect(deskUrl(CLASSIC_DESK_PATH, '', local)).toBe('/');
  });

  it('stays under the project mount', () => {
    expect(deskUrl(NEXT_DESK_PATH, '/p/camp', local)).toBe('/p/camp/next/');
    expect(deskUrl(CLASSIC_DESK_PATH, '/p/camp', local)).toBe('/p/camp/');
  });

  it('carries the paired runtime so a hosted desk keeps the project', () => {
    const url = new URL(deskUrl(NEXT_DESK_PATH, '', hosted), 'https://desk.example');
    expect(url.pathname).toBe('/next/');
    expect(url.searchParams.get('runtime')).toBe(hosted.runtimeUrl);
    expect(url.searchParams.get('token')).toBe('secret');
  });
});
