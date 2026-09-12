import QRCode from 'qrcode';

// The terminal renderer has no I/O, so passing a callback (instead of relying
// on the promise overload) runs it synchronously — the banner is built sync.
export function formatLinkQrCode(link: string): string {
  let code = '';
  let failure: Error | null = null;
  QRCode.toString(link, { type: 'terminal', small: true }, (error, qr) => {
    failure = error ?? null;
    code = qr;
  });
  if (failure) throw failure;
  return code;
}
