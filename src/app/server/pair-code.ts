import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { MachinePairCodeOutcome } from '@/types/index';

// Crockford base32, no I/L/O/U — unambiguous when read off a terminal or typed by hand.
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;
export const PAIR_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_FAILURES_PER_MINUTE = 20;
const FAILURE_WINDOW_MS = 60 * 1000;
const LONG_POLL_TIMEOUT_MS = 25 * 1000;

interface PairCodeRecord {
  expiresAt: number;
  attempts: number;
  outcome: MachinePairCodeOutcome;
}

export interface PairCodeManager {
  mint: () => { code: string; expiresAt: number };
  redeem: (rawCode: string, origin: string) => boolean;
  waitForOutcome: (rawCode: string) => Promise<MachinePairCodeOutcome>;
}

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CROCKFORD_ALPHABET[bytes[i] % CROCKFORD_ALPHABET.length];
  }
  return code;
}

function normalizeCode(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/** One instance for the daemon's whole run — pending codes are memory-only, so a
 *  restart voids them (IDEA-292). Shared between the root `/api/machine/pair-code`
 *  routes (mint + long-poll) and every mounted project's `/api/pair` (redeem). */
export function createPairCodeManager(now: () => number = Date.now): PairCodeManager {
  const codes = new Map<string, PairCodeRecord>();
  const events = new EventEmitter();
  const failures: number[] = [];

  function isRateLimited(): boolean {
    const cutoff = now() - FAILURE_WINDOW_MS;
    while (failures.length > 0 && failures[0] < cutoff) failures.shift();
    return failures.length >= MAX_FAILURES_PER_MINUTE;
  }

  function settle(code: string, record: PairCodeRecord, outcome: MachinePairCodeOutcome): void {
    record.outcome = outcome;
    events.emit(code, outcome);
  }

  function expireIfDue(code: string, record: PairCodeRecord): void {
    if (record.outcome.status === 'pending' && now() >= record.expiresAt) {
      settle(code, record, { status: 'expired' });
    }
  }

  return {
    mint() {
      const code = generateCode();
      const expiresAt = now() + PAIR_CODE_TTL_MS;
      codes.set(code, { expiresAt, attempts: 0, outcome: { status: 'pending' } });
      return { code, expiresAt };
    },

    redeem(rawCode, origin) {
      if (isRateLimited()) return false;
      const code = normalizeCode(rawCode);
      const record = codes.get(code);
      if (record) expireIfDue(code, record);
      if (record && record.outcome.status === 'pending') {
        settle(code, record, { status: 'paired', origin });
        return true;
      }

      failures.push(now());
      // A failed guess can't be attributed to the code it was a guess at — it
      // never matched one — so every still-outstanding code counts it as a
      // strike against itself, and a code under apparent brute force is
      // cancelled before its own ten minutes are up.
      for (const [pendingCode, pendingRecord] of codes) {
        if (pendingRecord.outcome.status !== 'pending') continue;
        pendingRecord.attempts += 1;
        if (pendingRecord.attempts >= MAX_ATTEMPTS_PER_CODE) {
          settle(pendingCode, pendingRecord, { status: 'expired' });
        }
      }
      return false;
    },

    waitForOutcome(rawCode) {
      const code = normalizeCode(rawCode);
      const record = codes.get(code);
      if (!record) return Promise.resolve({ status: 'expired' });
      expireIfDue(code, record);
      if (record.outcome.status !== 'pending') return Promise.resolve(record.outcome);

      const holdMs = Math.min(LONG_POLL_TIMEOUT_MS, Math.max(0, record.expiresAt - now()));
      return new Promise((resolve) => {
        const onOutcome = (outcome: MachinePairCodeOutcome) => {
          clearTimeout(timer);
          resolve(outcome);
        };
        const timer = setTimeout(() => {
          events.off(code, onOutcome);
          expireIfDue(code, record);
          resolve(record.outcome.status === 'pending' ? { status: 'pending' } : record.outcome);
        }, holdMs);
        events.once(code, onOutcome);
      });
    },
  };
}
