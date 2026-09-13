import type { HubMachine, HubProjectRow } from '@/app/services/hub-machines';

export interface ContinueTarget {
  machineUrl: string;
  row: HubProjectRow;
}

/** The project this browser opened most recently, across every machine —
 * the Continue strip's target, regardless of the running-first row order
 * each machine section sorts its own rows by. */
export function pickContinueTarget(machines: HubMachine[]): ContinueTarget | null {
  let best: ContinueTarget | null = null;
  for (const machine of machines) {
    for (const row of machine.projects) {
      if (!row.lastOpenedAt) continue;
      if (!best?.row.lastOpenedAt || row.lastOpenedAt > best.row.lastOpenedAt) {
        best = { machineUrl: machine.machineUrl, row };
      }
    }
  }
  return best;
}
