import { formatLinkQrCode } from './link-qr-code';

const paint = (code: string, text: string) => `\x1b[${code}m${text}\x1b[0m`;

// OSC 8: the terminal treats the whole span as one link, so a URL that wraps
// across lines stays clickable, which plain auto-detection cannot manage.
const hyperlink = (url: string) => `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`;

function palette(color: boolean) {
  if (!color) {
    const plain = (text: string) => text;
    return { bold: plain, dim: plain, green: plain, yellow: plain, link: plain };
  }
  return {
    bold: (text: string) => paint('1', text),
    dim: (text: string) => paint('2', text),
    green: (text: string) => paint('32', text),
    yellow: (text: string) => paint('1;33', text),
    link: (url: string) => paint('36', hyperlink(url)),
  };
}

export interface DevBannerInput {
  version: string;
  localUrl: string;
  networkLink?: string;
  networkBlocked?: boolean;
  tailnetLink?: string;
  tunnelLink?: string;
  color: boolean;
  tty: boolean;
}

/** One entry per way in: a bold label, then the link alone on its own line so
 * it is the whole line to copy or click. */
function entry(label: string, url: string, color: boolean): string {
  const { bold, link } = palette(color);
  return `${bold(label)}\n  ${link(url)}`;
}

/** The single best way in, ranked highest reachability first: a Tailnet
 * serve link beats a Tunnel link beats whatever host address was found. */
function bestEntry({ localUrl, networkLink, tailnetLink, tunnelLink }: DevBannerInput): {
  label: string;
  url: string;
} {
  if (tailnetLink) return { label: 'Tailnet', url: tailnetLink };
  if (tunnelLink) return { label: 'Tunnel', url: tunnelLink };
  if (networkLink) return { label: 'Network', url: networkLink };
  return { label: 'This host', url: localUrl };
}

export function formatDevBanner(input: DevBannerInput): string {
  const { version, networkBlocked, tailnetLink, tunnelLink, color, tty } = input;
  const { dim, yellow } = palette(color);
  const { label, url } = bestEntry(input);
  const lines = [`${yellow('⛺ Paper Camp')} ${dim(`v${version}`)}`, '', entry(label, url, color)];
  if (tty && (label === 'Tailnet' || label === 'Tunnel')) {
    lines.push(formatLinkQrCode(url));
  }
  if (!tailnetLink && !tunnelLink && !input.networkLink && networkBlocked) {
    lines.push(dim('Other devices need HTTPS — add --tailnet or --share.'));
  }
  return lines.join('\n');
}

const ESC = String.fromCharCode(27);
const URL_RE = new RegExp(`https?:\\/\\/[^\\s${ESC}]+`, 'g');

/** The daemon writes its banner to a log file, where colour is off, so `start`
 * and `logs` echo plain text; this re-adds the OSC 8 wrapper around each URL
 * for a terminal reader, leaving text that already carries escapes untouched. */
export function linkifyUrls(text: string): string {
  if (text.includes('\x1b]8;;')) return text;
  return text.replace(URL_RE, (url) => hyperlink(url));
}
