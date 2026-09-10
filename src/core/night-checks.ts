import type { NightCheckId, NightConfig, NightCustomCheck } from '../types/index';

export interface NightBuiltinCheck {
  id: NightCheckId;
  name: string;
  instructions: string;
}

export const NIGHT_BUILTIN_CHECKS: NightBuiltinCheck[] = [
  {
    id: 'bugs',
    name: 'bugs',
    instructions: 'logic errors and edge cases the code does not handle',
  },
  {
    id: 'dead-code',
    name: 'dead-code',
    instructions: 'unused exports, unreachable branches, and duplicated helpers',
  },
  {
    id: 'performance',
    name: 'performance',
    instructions: 'hot loops, repeated I/O, and unbounded growth',
  },
  {
    id: 'tests',
    name: 'tests',
    instructions: 'behaviour with no test covering it, and tests that assert nothing meaningful',
  },
  {
    id: 'docs',
    name: 'docs',
    instructions: 'comments and docs that contradict the code they describe',
  },
  {
    id: 'security',
    name: 'security',
    instructions: 'injection, unvalidated input, and secrets committed in the clear',
  },
  { id: 'a11y', name: 'a11y', instructions: 'missing labels, focus traps, and low contrast' },
];

export interface ResolvedNightCheck {
  id: string;
  name: string;
  instructions: string;
}

export function resolveNightChecks(config: NightConfig | undefined): ResolvedNightCheck[] {
  const toggles = config?.checks ?? {};
  const builtins = NIGHT_BUILTIN_CHECKS.filter((check) => toggles[check.id] !== false);
  const custom: ResolvedNightCheck[] = (config?.customChecks ?? []).map(
    (check: NightCustomCheck) => ({
      id: check.name,
      name: check.name,
      instructions: check.prompt,
    }),
  );
  return [...builtins, ...custom];
}
