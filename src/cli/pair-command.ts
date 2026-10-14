import { daemonStatePath, readRunningDaemonState } from '../core/daemon-state';
import { hostedClientUrl } from '../core/hosted-client';
import { readTailnetStatus } from '../core/tailnet';
import { loadOrMintUpdateToken, updateTokenPath } from '../core/update-token';
import {
  MACHINE_PAIR_CODE_PATH,
  type MachinePairCodeMintResponse,
  type MachinePairCodeOutcome,
} from '../types/index';
import { formatLinkQrCode } from './link-qr-code';

export function formatPairCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function pairQrLink(printedCode: string): string {
  return `${hostedClientUrl()}/#pair=${printedCode}`;
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

  if (process.stdout.isTTY) {
    console.log('Scan with your phone:');
    console.log(`  ${formatLinkQrCode(pairQrLink(printedCode))}`);
    console.log('Or enter in Paper Camp on another device:');
    console.log(`  Machine  ${tailnetStatus.selfDnsName}`);
    console.log(`  Code     ${formatPairCode(code)}`);
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
        console.log(`Paired ${outcome.origin}`);
        return true;
      }
      console.log('Code expired');
      return true;
    }
    return true;
  } finally {
    process.off('SIGINT', onSigint);
  }
}
