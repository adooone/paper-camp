const HORIZON_PREFIX_RE = /^Horizon\s+\d+\s*[—-]\s*/i;

export const stripHorizonPrefix = (title: string): string => title.replace(HORIZON_PREFIX_RE, '');
