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
  color: boolean;
}

/** One entry per way in: a bold label, then the link alone on its own line so
 * it is the whole line to copy or click. */
function entry(label: string, url: string, color: boolean): string {
  const { bold, link } = palette(color);
  return `${bold(label)}\n  ${link(url)}`;
}

export function formatDevBanner({
  version,
  localUrl,
  networkLink,
  networkBlocked,
  color,
}: DevBannerInput): string {
  const { dim, yellow } = palette(color);
  const lines = [
    `${yellow('⛺ Paper Camp')} ${dim(`v${version}`)}`,
    '',
    entry('This host', localUrl, color),
  ];
  if (networkLink) lines.push(entry('Network', networkLink, color));
  else if (networkBlocked) lines.push(dim('Other devices need HTTPS — add --tailnet or --share.'));
  return lines.join('\n');
}

export function formatShareLine(tunnelLink: string, color: boolean): string {
  return entry('Tunnel', tunnelLink, color);
}

export function formatTailnetLine(tailnetLink: string, color: boolean): string {
  return entry('Tailnet', tailnetLink, color);
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
