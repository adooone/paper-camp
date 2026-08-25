import type { CapabilityStatus } from '@/types/index';

export const CAPABILITY_STATUS_STAMP: Record<
  CapabilityStatus,
  { fill: string; text: string; label: string }
> = {
  ok: { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66', label: 'Ready' },
  warn: { fill: 'rgba(212, 163, 115, 0.25)', text: '#A67B4F', label: 'Needs attention' },
  missing: { fill: 'rgba(201, 139, 139, 0.25)', text: '#6E3A3A', label: 'Missing' },
};

export const MERGE_POLICY_STAMP: Record<'upToDate' | 'outdated', { fill: string; text: string }> = {
  upToDate: { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66' },
  outdated: { fill: 'rgba(212, 163, 115, 0.25)', text: '#A67B4F' },
};

export const VERSION_STAMP_FILL = 'rgba(143, 185, 150, 0.25)';
