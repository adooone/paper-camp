export type CapacityLevel = 'allowed' | 'warning' | 'rejected';

export function capacityLevel(status: string): CapacityLevel {
  if (status === 'allowed') return 'allowed';
  if (/reject|block|exceed|denied/i.test(status)) return 'rejected';
  return 'warning';
}

export function resetsAtMs(resetsAt: number): number {
  return resetsAt < 1e12 ? resetsAt * 1000 : resetsAt;
}
