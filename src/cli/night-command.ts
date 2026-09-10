import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  daemonStatePath,
  fetchMachineNightGate,
  readRunningDaemonState,
} from '../core/daemon-state';
import {
  type MachineProject,
  type MachineRegistry,
  clearNightProject,
  defaultRegistryPath,
  loadRegistry,
  saveRegistry,
  setNightProject,
} from '../core/machine-registry';
import {
  DEFAULT_NIGHT_CONFIG,
  type MachineNightGateResponse,
  type NightConfig,
  type NightGateBlockReason,
} from '../types/index';

export async function readNightConfig(root: string): Promise<NightConfig | undefined> {
  const raw = await readFile(join(root, 'papercamp', 'config.json'), 'utf-8').catch(() => null);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { night?: NightConfig };
    return parsed.night;
  } catch {
    return undefined;
  }
}

export interface ResolvedNightConfig {
  ceiling: number;
  floor: number;
  maxChunks: number;
  window?: NightConfig['window'];
  roots?: string[];
}

export function resolveNightConfig(config: NightConfig | undefined): ResolvedNightConfig {
  return {
    ceiling: config?.ceiling ?? DEFAULT_NIGHT_CONFIG.ceiling,
    floor: config?.floor ?? DEFAULT_NIGHT_CONFIG.floor,
    maxChunks: config?.maxChunks ?? DEFAULT_NIGHT_CONFIG.maxChunks,
    window: config?.window,
    roots: config?.roots,
  };
}

function formatNightSettings(resolved: ResolvedNightConfig): string {
  const lines = [
    `  ceiling (5h):   ${resolved.ceiling}%`,
    `  floor (7d):     ${resolved.floor}%`,
    `  window:         ${resolved.window ? `${resolved.window.from}–${resolved.window.to}` : '(none)'}`,
    `  roots:          ${resolved.roots?.join(', ') ?? '(every folder one level under src/)'}`,
    `  maxChunks:      ${resolved.maxChunks}`,
  ];
  return lines.join('\n');
}

const GATE_REASON_LABEL: Record<NightGateBlockReason, string> = {
  'dashboard-active': 'dashboard active in the last 30m',
  'task-running': 'an agent task is running',
  'no-capacity-snapshot': 'no capacity snapshot yet',
  'five-hour-ceiling': '5h ceiling exceeded',
  'seven-day-floor': '7d floor exceeded',
  'outside-window': 'outside the configured window',
};

function formatGateLine(response: MachineNightGateResponse | null): string {
  if (!response) {
    return '  gate:           unknown — start the daemon (`paper-camp daemon` or `paper-camp start`) to evaluate it live';
  }
  if (response.projectMissing) {
    return '  gate:           unknown — the selected project is no longer registered';
  }
  if (!response.gate) {
    return '  gate:           unknown — no project selected';
  }
  if (response.gate.open) {
    return '  gate:           open';
  }
  const reasons = response.gate.reasons.map((reason) => GATE_REASON_LABEL[reason]).join(', ');
  return `  gate:           blocked — ${reasons}`;
}

async function printNightStatus(registry: MachineRegistry): Promise<void> {
  if (!registry.night) {
    console.log('paper-camp: night shift is off');
    return;
  }
  const project = registry.projects.find((p) => p.slug === registry.night?.slug);
  if (!project) {
    console.log(
      `paper-camp: night shift is set to "${registry.night.slug}", but that project is no longer registered`,
    );
    return;
  }
  console.log(`paper-camp: night shift runs for "${project.slug}" (${project.path})`);
  const config = await readNightConfig(project.path);
  console.log(formatNightSettings(resolveNightConfig(config)));

  const daemonState = await readRunningDaemonState(daemonStatePath());
  const gateResponse = daemonState ? await fetchMachineNightGate(daemonState.port) : null;
  console.log(formatGateLine(gateResponse));
}

export async function runNight(target: string | undefined): Promise<boolean> {
  if (!target) {
    console.error('Usage: paper-camp night <slug> | off | status');
    return false;
  }

  const path = defaultRegistryPath();
  const registry = await loadRegistry(path);

  if (target === 'status') {
    await printNightStatus(registry);
    return true;
  }

  if (target === 'off') {
    if (!registry.night) {
      console.log('paper-camp: night shift is already off');
      return true;
    }
    await saveRegistry(path, clearNightProject(registry));
    console.log('paper-camp: night shift turned off');
    return true;
  }

  const result = setNightProject(registry, target);
  if (!result.ok) {
    console.error(
      `No registered project with slug "${target}" — run \`paper-camp ls\` to see registered projects.`,
    );
    return false;
  }
  await saveRegistry(path, result.registry);
  const project = result.registry.projects.find((p) => p.slug === target) as MachineProject;
  console.log(`paper-camp: night shift set to "${project.slug}" (${project.path})`);
  return true;
}
