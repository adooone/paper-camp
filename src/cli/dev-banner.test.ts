import { describe, expect, it } from 'vitest';
import { formatDevBanner, linkifyUrls } from './dev-banner';

const input = {
  version: '0.21.1',
  localUrl: 'http://localhost:3333',
  networkLink: 'https://paper-camp.vercel.app/?runtime=http://100.80.79.13:3333&token=abc',
};

describe('formatDevBanner', () => {
  it('greets with the version and prints the This host link when nothing better was found', () => {
    const banner = formatDevBanner({ ...input, networkLink: undefined, color: false });
    expect(banner).toContain('Paper Camp');
    expect(banner).toContain('v0.21.1');
    expect(banner).toContain('This host\n  http://localhost:3333');
  });

  it('prefers the Network link over the loopback link', () => {
    const banner = formatDevBanner({ ...input, color: false });
    expect(banner).toContain(`Network\n  ${input.networkLink}`);
    expect(banner).not.toContain('This host');
  });

  it('prints the HTTPS remedy instead of any link row when the pair is blocked', () => {
    const banner = formatDevBanner({
      ...input,
      networkLink: undefined,
      networkBlocked: true,
      color: false,
    });
    expect(banner).toContain('This host');
    expect(banner).toContain('add --tailnet or --share');
  });

  it('prefers the Network row over the remedy when a link is present', () => {
    const banner = formatDevBanner({ ...input, networkBlocked: true, color: false });
    expect(banner).toContain(`Network\n  ${input.networkLink}`);
    expect(banner).not.toContain('add --tailnet or --share');
  });

  it('prefers Tailnet over Tunnel, Network, and the loopback link', () => {
    const banner = formatDevBanner({
      ...input,
      tailnetLink: 'https://paper-camp.vercel.app/?runtime=https://box.tailnet.ts.net/&token=abc',
      tunnelLink: 'https://paper-camp.vercel.app/?runtime=https://foo.trycloudflare.com&token=abc',
      color: false,
    });
    expect(banner).toContain(
      'Tailnet\n  https://paper-camp.vercel.app/?runtime=https://box.tailnet.ts.net/&token=abc',
    );
    expect(banner).not.toContain('Network');
    expect(banner).not.toContain('Tunnel\n');
  });

  it('prefers Tunnel over Network and the loopback link when there is no Tailnet link', () => {
    const banner = formatDevBanner({
      ...input,
      tunnelLink: 'https://paper-camp.vercel.app/?runtime=https://foo.trycloudflare.com&token=abc',
      color: false,
    });
    expect(banner).toContain(
      'Tunnel\n  https://paper-camp.vercel.app/?runtime=https://foo.trycloudflare.com&token=abc',
    );
    expect(banner).not.toContain('Network');
  });

  it('prints exactly one link entry', () => {
    const banner = formatDevBanner({
      ...input,
      tailnetLink: 'https://paper-camp.vercel.app/?runtime=https://box.tailnet.ts.net/&token=abc',
      tunnelLink: 'https://paper-camp.vercel.app/?runtime=https://foo.trycloudflare.com&token=abc',
      color: false,
    });
    const linkLines = banner.split('\n').filter((line) => line.startsWith('  http'));
    expect(linkLines).toHaveLength(1);
  });

  it('wraps the link in an OSC 8 hyperlink with color, so a wrapped URL stays clickable', () => {
    const banner = formatDevBanner({ ...input, networkLink: undefined, color: true });
    expect(banner).toContain(`\x1b]8;;${input.localUrl}\x1b\\${input.localUrl}\x1b]8;;\x1b\\`);
  });

  it('emits no escape codes without color, so piped output stays clean', () => {
    expect(formatDevBanner({ ...input, color: false })).not.toContain('\x1b[');
  });

  it('colorizes when asked, still carrying the same text', () => {
    const banner = formatDevBanner({ ...input, color: true });
    expect(banner).toContain('\x1b[');
    const esc = String.fromCharCode(27);
    const colorCode = new RegExp(`${esc}\\[[0-9;]*m`, 'g');
    const hyperlinkWrapper = new RegExp(`${esc}\\]8;;[^${esc}]*${esc}\\\\`, 'g');
    expect(banner.replaceAll(colorCode, '').replaceAll(hyperlinkWrapper, '')).toBe(
      formatDevBanner({ ...input, color: false }),
    );
  });
});

describe('linkifyUrls', () => {
  it('wraps each plain URL in an OSC 8 hyperlink and leaves other text alone', () => {
    const out = linkifyUrls(
      'This host\n  https://paper-camp.vercel.app/?machine=x&token=y\nopens the dashboard',
    );
    expect(out).toContain(
      '\x1b]8;;https://paper-camp.vercel.app/?machine=x&token=y\x1b\\https://paper-camp.vercel.app/?machine=x&token=y\x1b]8;;\x1b\\',
    );
    expect(out).toContain('opens the dashboard');
  });

  it('does not double-wrap text that already carries hyperlinks', () => {
    const banner = formatDevBanner({ ...input, color: true });
    expect(linkifyUrls(banner)).toBe(banner);
  });
});
