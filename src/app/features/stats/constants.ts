import { STATUS_LABEL } from '@/app/features/plans/constants';
import { type EntityStatus, PLAN_STATUSES } from '@/types/index';

export const ENTITY_STATUS_ORDER: EntityStatus[] = ['open', ...PLAN_STATUSES];

export const ENTITY_STATUS_LABEL: Record<EntityStatus, string> = { ...STATUS_LABEL, open: 'Open' };

export const CAPACITY_STAMP = {
  allowed: 'success',
  warning: 'warning',
  rejected: 'error',
} as const;
