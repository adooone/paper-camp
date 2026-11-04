import QRCode from 'qrcode';

// Two modules per cell (▀ top, ▄ bottom) keep the code square. Bright white, not
// ANSI 47, which dark themes draw as grey and cameras read poorly.
const LIGHT_ON_DARK = '\x1b[97;40m';
const RESET = '\x1b[0m';
const QUIET_ZONE = 2;

const CELL: Record<string, string> = {
  '00': '█', // both light
  '01': '▀', // light top, dark bottom
  '10': '▄', // dark top, light bottom
  '11': ' ', // both dark
};

/** Renders `link` as a terminal QR code, each line prefixed with `indent`.
 *  Low error correction keeps the code small: it is read off a screen, never
 *  printed or damaged. Throws when the link is too long for any QR version. */
export function formatLinkQrCode(link: string, indent = ''): string {
  const { modules } = QRCode.create(link, { errorCorrectionLevel: 'L' });
  const size = modules.size;
  const dark = (row: number, col: number): number =>
    row >= 0 && row < size && col >= 0 && col < size && modules.get(row, col) ? 1 : 0;

  const lines: string[] = [];
  for (let row = -QUIET_ZONE; row < size + QUIET_ZONE; row += 2) {
    let line = '';
    for (let col = -QUIET_ZONE; col < size + QUIET_ZONE; col++) {
      line += CELL[`${dark(row, col)}${dark(row + 1, col)}`];
    }
    lines.push(`${indent}${LIGHT_ON_DARK}${line}${RESET}`);
  }
  return lines.join('\n');
}
