import type { ResolvedRoadmapItem } from '@/types/index';
import type { StampVariant } from '@dendelion/paper-ui';
import { colors, withAlpha } from '@dendelion/paper-ui/tokens';

export const HIGHLIGHT_OUTLINE_COLOR = withAlpha(colors.accentAmber, 0.5);

export const ITEM_STATE_STAMP: Record<
  ResolvedRoadmapItem['state'],
  { variant: StampVariant; label: string }
> = {
  'not-started': { variant: 'neutral', label: 'Not started' },
  'in-progress': { variant: 'warning', label: 'In progress' },
  shipped: { variant: 'success', label: 'Shipped' },
};
