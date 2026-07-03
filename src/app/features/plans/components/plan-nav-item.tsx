import type { PlanEntry } from '@/types/index';
import { ListItem, Tooltip } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';
import { STATUS_COLOR } from '../constants';
import { phasePercentage } from '../helpers';
import { MiniProgress } from './mini-progress';

interface PlanNavItemProps {
  plan: PlanEntry;
  active: boolean;
  onClick: () => void;
  action?: ReactNode;
}

export const PlanNavItem = ({ plan, active, onClick, action }: PlanNavItemProps) => {
  const pct = phasePercentage(plan);
  const color = STATUS_COLOR[plan.status];

  return (
    <Tooltip content={plan.title} placement="right">
      <ListItem
        active={active}
        onClick={onClick}
        size="small"
        icon={
          <span
            style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }}
          />
        }
        action={
          <>
            {pct !== null && <MiniProgress pct={pct} color={color} />}
            {action}
          </>
        }
      >
        {plan.title}
      </ListItem>
    </Tooltip>
  );
};
