import type { PlanEntry } from '@/types/index';

export const relativeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

export const phaseProgress = (plan: PlanEntry) => {
  if (plan.phases.length === 0) return null;
  const done = plan.phases.filter((p) => p.done).length;
  return { done, total: plan.phases.length, pct: Math.round((done / plan.phases.length) * 100) };
};

export const phasePercentage = (plan: PlanEntry): number | null => phaseProgress(plan)?.pct ?? null;

export const findFocusPlan = (
  plans: PlanEntry[] | undefined,
  activePlanTitle?: string | null,
): PlanEntry | undefined => {
  if (!plans) return undefined;
  if (activePlanTitle) {
    const selected = plans.find((p) => p.title === activePlanTitle);
    if (selected) return selected;
  }
  return plans.find((p) => p.status === 'in-progress' || p.status === 'review');
};
