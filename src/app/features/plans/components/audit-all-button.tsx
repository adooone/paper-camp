import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import { Button } from '@dendelion/paper-ui';
import { useState } from 'react';

export const AuditAllButton = () => {
  const launchBatchAudit = useAppStore((s) => s.launchBatchAudit);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const [launching, setLaunching] = useState(false);

  const agentBusy =
    agentStatus !== null && agentStatus.status !== 'done' && agentStatus.status !== 'error';

  const handleClick = async () => {
    setLaunching(true);
    try {
      await launchBatchAudit();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="small"
      onClick={handleClick}
      disabled={agentBusy || launching}
      style={{ color: color.textSecondary }}
    >
      Audit all
    </Button>
  );
};
