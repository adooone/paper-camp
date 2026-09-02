import type { DeskCheck, DeskCi, DeskConfig, DeskService } from '@/types/index';

export type ServiceChange =
  | { kind: 'added'; service: DeskService }
  | { kind: 'removed'; service: DeskService }
  | { kind: 'changed'; before: DeskService; after: DeskService };

export type CheckChange =
  | { kind: 'added'; check: DeskCheck }
  | { kind: 'removed'; check: DeskCheck }
  | { kind: 'changed'; before: DeskCheck; after: DeskCheck };

export type CiChange =
  | { kind: 'added'; ci: DeskCi }
  | { kind: 'removed'; ci: DeskCi }
  | { kind: 'changed'; before: DeskCi; after: DeskCi };

export interface DeskDiff {
  services: ServiceChange[];
  checks: CheckChange[];
  ci: CiChange | null;
}

const serviceKey = (s: DeskService) => `${s.cmd}`;
const checkKey = (c: DeskCheck) => `${c.cmd}`;

const ciKey = (c: DeskCi) => `${c.repo}|${c.branch ?? ''}|${c.releasePlease ? '1' : '0'}`;

const sameService = (a: DeskService, b: DeskService) =>
  a.name === b.name &&
  a.cmd === b.cmd &&
  (a.port ?? null) === (b.port ?? null) &&
  (a.healthcheck ?? null) === (b.healthcheck ?? null);

const sameCheck = (a: DeskCheck, b: DeskCheck) => a.name === b.name && a.cmd === b.cmd;

export function diffDeskConfig(
  current: DeskConfig | null | undefined,
  proposed: DeskConfig,
): DeskDiff {
  const currentServices = current?.services ?? [];
  const proposedServices = proposed.services ?? [];
  const currentChecks = current?.checks ?? [];
  const proposedChecks = proposed.checks ?? [];
  const currentCi = current?.ci;
  const proposedCi = proposed.ci;

  const services: ServiceChange[] = [];
  const proposedServiceMap = new Map(proposedServices.map((s) => [serviceKey(s), s]));
  const currentServiceMap = new Map(currentServices.map((s) => [serviceKey(s), s]));
  for (const [key, after] of proposedServiceMap) {
    const before = currentServiceMap.get(key);
    if (!before) services.push({ kind: 'added', service: after });
    else if (!sameService(before, after)) services.push({ kind: 'changed', before, after });
  }
  for (const [key, before] of currentServiceMap) {
    if (!proposedServiceMap.has(key)) services.push({ kind: 'removed', service: before });
  }

  const checks: CheckChange[] = [];
  const proposedCheckMap = new Map(proposedChecks.map((c) => [checkKey(c), c]));
  const currentCheckMap = new Map(currentChecks.map((c) => [checkKey(c), c]));
  for (const [key, after] of proposedCheckMap) {
    const before = currentCheckMap.get(key);
    if (!before) checks.push({ kind: 'added', check: after });
    else if (!sameCheck(before, after)) checks.push({ kind: 'changed', before, after });
  }
  for (const [key, before] of currentCheckMap) {
    if (!proposedCheckMap.has(key)) checks.push({ kind: 'removed', check: before });
  }

  let ci: CiChange | null = null;
  if (currentCi && proposedCi) {
    if (ciKey(currentCi) !== ciKey(proposedCi))
      ci = { kind: 'changed', before: currentCi, after: proposedCi };
  } else if (currentCi && !proposedCi) {
    ci = { kind: 'removed', ci: currentCi };
  } else if (!currentCi && proposedCi) {
    ci = { kind: 'added', ci: proposedCi };
  }

  return { services, checks, ci };
}

export function isDiffEmpty(diff: DeskDiff): boolean {
  return diff.services.length === 0 && diff.checks.length === 0 && diff.ci === null;
}
