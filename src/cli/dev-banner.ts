const paint = (code: string, text: string) => `\x1b[${code}m${text}\x1b[0m`;

function palette(color: boolean) {
  if (!color) {
    const plain = (text: string) => text;
    return { bold: plain, dim: plain, green: plain, cyan: plain, yellow: plain };
  }
  return {
    bold: (text: string) => paint('1', text),
    dim: (text: string) => paint('2', text),
    green: (text: string) => paint('32', text),
    cyan: (text: string) => paint('36', text),
    yellow: (text: string) => paint('1;33', text),
  };
}

// Pad before colorizing — escape codes would count toward the pad width.
const LABEL_WIDTH = 'Network:'.length;

export interface DevBannerInput {
  version: string;
  localUrl: string;
  networkLink?: string;
  color: boolean;
}

export function formatDevBanner({ version, localUrl, networkLink, color }: DevBannerInput): string {
  const { bold, dim, green, cyan, yellow } = palette(color);
  const row = (label: string, value: string) =>
    `  ${green('➜')}  ${bold(label.padEnd(LABEL_WIDTH))} ${cyan(value)}`;

  const lines = [
    '',
    `  ${yellow('⛺ Paper Camp')} ${dim(`v${version}`)} ${dim('— camp is up')}`,
    '',
    row('Local:', localUrl),
  ];
  if (networkLink) {
    lines.push(
      row('Network:', networkLink),
      `     ${dim('open the Network link on another device to pair it with this machine')}`,
    );
  }
  return lines.join('\n');
}

function formatExternalLink(label: string, link: string, note: string, color: boolean): string {
  const { bold, dim, green, cyan } = palette(color);
  return `  ${green('➜')}  ${bold(label.padEnd(LABEL_WIDTH))} ${cyan(link)}  ${dim(note)}`;
}

export function formatDimNote(note: string, color: boolean): string {
  const { dim } = palette(color);
  return `     ${dim(note)}`;
}

export function formatShareLine(tunnelLink: string, color: boolean): string {
  return formatExternalLink('Tunnel:', tunnelLink, '(reachable from anywhere)', color);
}

export function formatTailnetLine(tailnetLink: string, color: boolean): string {
  return formatExternalLink(
    'Tailnet:',
    tailnetLink,
    '(stable HTTPS address on your tailnet)',
    color,
  );
}
