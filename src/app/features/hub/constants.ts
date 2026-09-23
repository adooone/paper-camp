import { STATUS_COLOR } from '@/app/features/plans/constants';
import type { EntityStatus, NightFindingSeverity } from '@/types/index';
import { color, colors } from '@dendelion/paper-ui/tokens';

export const ENTITY_STATUS_COLOR: Record<EntityStatus, string> = {
  ...STATUS_COLOR,
  open: colors.textTertiary,
};

export const SEVERITY_COLOR: Record<NightFindingSeverity, string> = {
  critical: color.accentRoseDark,
  high: color.accentAmberDark,
  normal: color.accentSlate,
};

export const SEVERITY_LABEL: Record<NightFindingSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
};

export const SEVERITY_ORDER: NightFindingSeverity[] = ['critical', 'high', 'normal'];
