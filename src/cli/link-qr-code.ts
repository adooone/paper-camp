import QRCode from 'qrcode';

export function formatLinkQrCode(link: string): Promise<string> {
  return QRCode.toString(link, { type: 'terminal', small: true });
}
