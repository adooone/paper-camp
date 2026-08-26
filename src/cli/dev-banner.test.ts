import { describe, expect, it } from 'vitest';
import { formatDevBanner, formatShareLine } from './dev-banner';

const input = {
  version: '0.21.1',
  localUrl: 'http://localhost:3333',
  networkLink: 'https://paper-camp.vercel.app/?runtime=http%3A%2F%2F100.80.79.13%3A3333&token=abc',
};

describe('formatDevBanner', () => {
  it('greets with the version and lists Local and Network links', () => {
    const banner = formatDevBanner({ ...input, color: false });
    expect(banner).toContain('Paper Camp');
    expect(banner).toContain('v0.21.1');
    expect(banner).toContain('Local:   http://localhost:3333');
    expect(banner).toContain(`Network: ${input.networkLink}`);
    expect(banner).toContain('another device');
  });

  it('omits the Network row and its hint when the machine has no reachable address', () => {
    const banner = formatDevBanner({ ...input, networkLink: undefined, color: false });
    expect(banner).toContain('Local:');
    expect(banner).not.toContain('Network:');
    expect(banner).not.toContain('another device');
  });

  it('emits no escape codes without color, so piped output stays clean', () => {
    expect(formatDevBanner({ ...input, color: false })).not.toContain('\x1b[');
  });

  it('colorizes when asked, still carrying the same text', () => {
    const banner = formatDevBanner({ ...input, color: true });
    expect(banner).toContain('\x1b[');
    const escapeCode = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
    expect(banner.replaceAll(escapeCode, '')).toBe(formatDevBanner({ ...input, color: false }));
  });
});

describe('formatShareLine', () => {
  it('labels the tunnel link and says it is reachable from anywhere', () => {
    const line = formatShareLine('https://foo-bar.trycloudflare.com', false);
    expect(line).toContain('Tunnel:');
    expect(line).toContain('https://foo-bar.trycloudflare.com');
    expect(line).toContain('reachable from anywhere');
  });
});
