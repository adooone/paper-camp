import type { MachineNightGateResponse, NightHealthMap } from '../types/index';
import { selectNightChunks } from './night-health';

export const NIGHT_TICK_MS = 5 * 60 * 1000;

// Shared with the Settings *Run a pass now* route, so a pass started by hand and
// one started by the shift never review the same repo at once.
const passesInFlight = new Set<string>();

export function isNightPassRunning(root: string): boolean {
  return passesInFlight.has(root);
}

export function markNightPass(root: string, running: boolean): void {
  if (running) passesInFlight.add(root);
  else passesInFlight.delete(root);
}

export interface NightShiftProject {
  slug: string;
  path: string;
}

export interface NightShiftDeps {
  evaluateGate: () => Promise<MachineNightGateResponse>;
  findProject: (slug: string) => Promise<NightShiftProject | null>;
  readSettings: (root: string) => Promise<{ threshold: number; maxChunks: number }>;
  computeMap: (root: string) => Promise<NightHealthMap>;
  runPass: (project: NightShiftProject, chunkPath: string) => Promise<boolean>;
  isMachineBusy: () => boolean;
  now?: () => number;
  log?: (line: string) => void;
}

export interface NightShiftState {
  night: string | null;
  reviewedTonight: Set<string>;
  running: boolean;
}

export function createNightShiftState(): NightShiftState {
  return { night: null, reviewedTonight: new Set(), running: false };
}

function nightOf(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** One tick of the shift: when the gate is open, review the chunks above the
 *  threshold in score order, re-checking the gate before every pass and stopping
 *  the moment it closes. A chunk is reviewed at most once per night. */
export async function nightShiftTick(state: NightShiftState, deps: NightShiftDeps): Promise<void> {
  if (state.running) return;
  const now = deps.now?.() ?? Date.now();
  const log = deps.log ?? console.log;
  const night = nightOf(now);
  if (state.night !== night) {
    state.night = night;
    state.reviewedTonight = new Set();
  }

  let gate = await deps.evaluateGate();
  if (!gate.slug || !gate.gate?.open || deps.isMachineBusy()) return;
  const project = await deps.findProject(gate.slug);
  if (!project || isNightPassRunning(project.path)) return;

  const settings = await deps.readSettings(project.path);
  const map = await deps.computeMap(project.path);
  const chunks = selectNightChunks(map, {
    threshold: settings.threshold,
    maxChunks: settings.maxChunks,
    exclude: state.reviewedTonight,
  });
  if (chunks.length === 0) return;

  state.running = true;
  markNightPass(project.path, true);
  try {
    for (const [index, chunk] of chunks.entries()) {
      if (index > 0) {
        gate = await deps.evaluateGate();
        if (!gate.gate?.open || deps.isMachineBusy()) {
          log(
            `paper-camp: night shift stopping — ${gate.gate?.reasons.join(', ') || 'machine busy'}`,
          );
          break;
        }
      }
      log(`paper-camp: night shift reviewing "${chunk.path}" (score ${chunk.score})`);
      state.reviewedTonight.add(chunk.path);
      await deps.runPass(project, chunk.path);
    }
  } finally {
    markNightPass(project.path, false);
    state.running = false;
  }
}

export function startNightShift(deps: NightShiftDeps, tickMs: number = NIGHT_TICK_MS): () => void {
  const state = createNightShiftState();
  const tick = () => {
    nightShiftTick(state, deps).catch((error) => {
      (deps.log ?? console.log)(
        `paper-camp: night shift tick failed — ${(error as Error).message}`,
      );
    });
  };
  const timer = setInterval(tick, tickMs);
  return () => clearInterval(timer);
}
