import { describe, expect, it } from 'vitest';
import { formatLinkQrCode } from './link-qr-code';

describe('formatLinkQrCode', () => {
  it('renders half-block characters over a colored background', () => {
    const code = formatLinkQrCode('https://paper-camp.vercel.app/?token=abc');
    expect(code).toMatch(/[▄▀█]/);
    expect(code).toContain('\x1b[');
  });

  it('grows with the link so the code always fits it', () => {
    const short = formatLinkQrCode('https://a.b/c');
    const long = formatLinkQrCode(
      `https://paper-camp.vercel.app/?runtime=https://foo.trycloudflare.com&token=${'a'.repeat(64)}`,
    );
    expect(long.split('\n').length).toBeGreaterThan(short.split('\n').length);
  });

  it('throws when the link is too big for any QR version to hold', () => {
    expect(() => formatLinkQrCode(`https://${'a'.repeat(5000)}`)).toThrow();
  });
});
