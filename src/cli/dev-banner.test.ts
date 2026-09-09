import { describe, expect, it } from 'vitest';
import { formatDevBanner, formatShareLine, formatTailnetLine, linkifyUrls } from './dev-banner';

const input = {
  version: '0.21.1',
  localUrl: 'http://localhost:3333',
  networkLink: 'https://paper-camp.vercel.app/?runtime=http://100.80.79.13:3333&token=abc',
};

describe('formatDevBanner', () => {
  it('greets with the version and lists Local and Network links', () => {
    const banner = formatDevBanner({ ...input, color: false });
    expect(banner).toContain('Paper Camp');
    expect(banner).toContain('v0.21.1');
    expect(banner).toContain('This host\n  http://localhost:3333');
    expect(banner).toContain(`Network\n  ${input.networkLink}`);
  });

  it('omits the Network row and its hint when the machine has no reachable address', () => {
    const banner = formatDevBanner({ ...input, networkLink: undefined, color: false });
    expect(banner).toContain('This host');
    expect(banner).not.toContain('Network');
  });

  it('prints the HTTPS remedy instead of the Network row when the pair is blocked', () => {
    const banner = formatDevBanner({
      ...input,
      networkLink: undefined,
      networkBlocked: true,
      color: false,
    });
    expect(banner).toContain('This host');
    expect(banner).not.toContain('Network\n');
    expect(banner).toContain('add --tailnet or --share');
  });

  it('prefers the Network row over the remedy when a link is present', () => {
    const banner = formatDevBanner({ ...input, networkBlocked: true, color: false });
    expect(banner).toContain(`Network\n  ${input.networkLink}`);
    expect(banner).not.toContain('add --tailnet or --share');
  });

  it('wraps each link in an OSC 8 hyperlink with color, so a wrapped URL stays clickable', () => {
    const banner = formatDevBanner({ ...input, color: true });
    expect(banner).toContain(`\x1b]8;;${input.localUrl}\x1b\\${input.localUrl}\x1b]8;;\x1b\\`);
    expect(banner).toContain(`\x1b]8;;${input.networkLink}\x1b\\`);
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

describe('formatShareLine', () => {
  it('labels the tunnel link on its own line', () => {
    const line = formatShareLine('https://foo-bar.trycloudflare.com', false);
    expect(line).toContain('Tunnel\n  ');
    expect(line).toContain('https://foo-bar.trycloudflare.com');
  });
});

describe('formatTailnetLine', () => {
  it('labels the tailnet link on its own line', () => {
    const line = formatTailnetLine('https://paper-camp.vercel.app/?runtime=…', false);
    expect(line).toContain('Tailnet\n  ');
    expect(line).toContain('https://paper-camp.vercel.app/?runtime=…');
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
