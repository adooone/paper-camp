export const formatAge = (ageDays: number): string => {
  if (!Number.isFinite(ageDays)) return 'age unknown';
  if (ageDays <= 0) return 'today';
  return ageDays === 1 ? '1 day ago' : `${ageDays} days ago`;
};
