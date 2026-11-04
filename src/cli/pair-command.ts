import { daemonStatePath, readRunningDaemonState } from '../core/daemon-state';
import { hostedClientUrl } from '../core/hosted-client';
import { PAPER_CAMP_VERSION } from '../core/scaffold';
import { readTailnetStatus } from '../core/tailnet';
import { loadOrMintUpdateToken, updateTokenPath } from '../core/update-token';
import {
  MACHINE_PAIR_CODE_PATH,
  type MachinePairCodeMintResponse,
  type MachinePairCodeOutcome,
} from '../types/index';
import { palette } from './dev-banner';
import { formatLinkQrCode } from './link-qr-code';

export function formatPairCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function pairQrLink(printedCode: string): string {
  return `${hostedClientUrl()}/#pair=${printedCode}`;
}

export interface PairBannerInput {
  machine: string;
  /** The code as printed, `XXXX-XXXX`. */
  code: string;
  link: string;
  color: boolean;
}

/** The terminal screen `paper-camp pair` shows: the daemon banner's header, the
 *  QR, then the same pairing as text for a device that can't scan. */
export function formatPairBanner({ machine, code, link, color }: PairBannerInput): string {
  const { bold, dim, yellow } = palette(color);
  return [
    `${yellow('⛺ Paper Camp')} ${dim(`v${PAPER_CAMP_VERSION}`)}  ${bold('Pair a device')}`,
    '',
    formatLinkQrCode(link, '  '),
    '',
    `  ${dim('Scan with your phone, or enter on another device:')}`,
    '',
    `  ${dim('Machine')}  ${machine}`,
    `  ${dim('Code')}     ${yellow(code)}`,
    '',
    `  ${dim('Expires in 10 minutes · Ctrl-C to cancel')}`,
    `  ${dim('Waiting for a device…')}`,
  ].join('\n');
}

/** Waits on the daemon's long-poll until the code is paired or expires, or until
 *  Ctrl-C aborts it — the code itself is left to expire on its own ten-minute TTL,
 *  since the daemon exposes no cancel route (IDEA-292). */
export async function runPair(): Promise<boolean> {
  const running = await readRunningDaemonState(daemonStatePath());
  if (!running) {
    console.error('paper-camp: daemon is not running — run `paper-camp start` first');
    return false;
  }

  const tailnetStatus = await readTailnetStatus();
  if (!running.tailnet || !tailnetStatus) {
    console.error("paper-camp: this machine isn't on a tailnet — start the daemon with --tailnet");
    return false;
  }

  const token = await loadOrMintUpdateToken(updateTokenPath());
  const base = `http://localhost:${running.port}`;
  const headers = { authorization: `Bearer ${token}` };

  const mintResponse = await fetch(`${base}${MACHINE_PAIR_CODE_PATH}`, { method: 'POST', headers });
  if (!mintResponse.ok) {
    console.error('paper-camp: could not mint a pairing code');
    return false;
  }
  const { code } = (await mintResponse.json()) as MachinePairCodeMintResponse;
  const printedCode = `${formatPairCode(code)}@${tailnetStatus.selfDnsName}`;

  const tty = process.stdout.isTTY === true;
  const { green, yellow } = palette(tty && !process.env.NO_COLOR);
  if (tty) {
    console.log(
      formatPairBanner({
        machine: tailnetStatus.selfDnsName,
        code: formatPairCode(code),
        link: pairQrLink(printedCode),
        color: !process.env.NO_COLOR,
      }),
    );
  } else {
    console.log(printedCode);
  }

  const controller = new AbortController();
  let cancelled = false;
  const onSigint = () => {
    cancelled = true;
    controller.abort();
  };
  process.on('SIGINT', onSigint);

  try {
    while (!cancelled) {
      let response: Response;
      try {
        response = await fetch(`${base}${MACHINE_PAIR_CODE_PATH}/${code}`, {
          headers,
          signal: controller.signal,
        });
      } catch {
        break;
      }
      if (!response.ok) {
        console.error('paper-camp: lost contact with the daemon while waiting');
        return false;
      }
      const outcome = (await response.json()) as MachinePairCodeOutcome;
      if (outcome.status === 'pending') continue;
      if (outcome.status === 'paired') {
        console.log(
          tty ? `\n  ${green('✓ Paired')} ${outcome.origin}` : `Paired ${outcome.origin}`,
        );
        return true;
      }
      console.log(
        tty
          ? `\n  ${yellow('Code expired')} — run \`paper-camp pair\` for a new one`
          : 'Code expired',
      );
      return true;
    }
    return true;
  } finally {
    process.off('SIGINT', onSigint);
  }
}
