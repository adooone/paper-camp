import { useChecksClient } from '@/app/hooks/use-checks-client';
import { useFocusClient } from '@/app/hooks/use-focus-client';
import { useStatusClient } from '@/app/hooks/use-status-client';
import { ScoutCard } from './scout/scout-card';
import { ScoutTrigger } from './scout/scout-trigger';

export interface ToolbarProps {
  route?: string;
}

export const Toolbar = (_props: ToolbarProps) => {
  const status = useStatusClient();
  const checks = useChecksClient();
  const focusPlan = useFocusClient();

  return (
    <ScoutTrigger>
      <ScoutCard status={status} checks={checks} focusPlan={focusPlan} />
    </ScoutTrigger>
  );
};
