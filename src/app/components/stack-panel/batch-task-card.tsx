import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { AGENT_LABELS } from '@/types/index';
import {
  Button,
  Card,
  CloseIcon,
  IconButton,
  Stamp,
  type StampVariant,
  useToast,
} from '@dendelion/folk-ui';
import { TASK_CARD_HEIGHT_CLASS } from './shared';

const pauseLabel = (reasonKind: string): string => {
  switch (reasonKind) {
    case 'capacity-ceiling':
      return 'waiting for the 5h reset';
    case 'capacity-floor':
      return '7d floor exceeded';
    case 'failed-dirty':
      return 'failed, tree dirty';
    case 'red-checks':
      return 'checks red';
    case 'auth':
      return 'signed out';
    case 'conflict':
      return 'conflict';
    default:
      return 'paused';
  }
};

const statusVariant: Record<string, StampVariant> = {
  running: 'warning',
  paused: 'warning',
  interrupted: 'warning',
  done: 'success',
};

export const BatchTaskCard = () => {
  const batchStatus = useAppStore((s) => s.batchStatus);
  const openBatchSheet = useAppStore((s) => s.openBatchSheet);
  const controlBatch = useAppStore((s) => s.controlBatch);
  const dismissed = useAppStore((s) => s.batchSummaryDismissed);
  const dismissSummary = useAppStore((s) => s.dismissBatchSummary);
  const { toast } = useToast();
  const batch = batchStatus?.batch;
  if (!batch) return null;
  if (batch.status === 'done' && dismissed) return null;

  const total = batch.initialIds.length;
  const doneCount = batch.items.filter(
    (item) => item.outcome !== 'queued' && item.outcome !== 'running',
  ).length;
  const running = batch.items.find((item) => item.outcome === 'running');
  const task = batchStatus?.task;
  const ideaTask = batchStatus?.ideaTask;
  const lastLine =
    ideaTask?.lines?.[ideaTask.lines.length - 1] ?? task?.lines?.[task.lines.length - 1];
  const terminal = batch.status === 'done';

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await controlBatch('stop');
    } catch (err) {
      toast({
        title: 'Failed to stop the queue',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissSummary();
  };

  return (
    <Card
      surface="chalkboard"
      size="small"
      className={TASK_CARD_HEIGHT_CLASS}
      onClick={openBatchSheet}
      ariaLabel="Run queue"
    >
      <div className="flex h-full min-w-0 flex-col justify-between gap-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate font-handwritten text-sm leading-tight text-desk-chalk">
            Run queue — {doneCount}/{total}
          </span>
          {batch.status === 'running' && (
            <IconButton
              icon={<CloseIcon size={20} />}
              variant="ghost"
              size="tiny"
              surface="chalkboard"
              label="Stop queue"
              onClick={handleStop}
            />
          )}
          {terminal && (
            <IconButton
              icon={<CloseIcon size={20} />}
              variant="ghost"
              size="tiny"
              surface="chalkboard"
              label="Dismiss"
              onClick={handleDismiss}
            />
          )}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate whitespace-nowrap font-handwritten text-xs text-desk-text-muted">
            {terminal
              ? `${batch.ideasRun} idea(s) run`
              : running
                ? `${running.id} — ${lastLine ?? AGENT_LABELS[task?.agentId ?? 'claude-code']}`
                : 'queued'}
          </span>
          <Stamp
            surface="chalkboard"
            size="small"
            variant={batch.status === 'paused' ? 'error' : statusVariant[batch.status]}
            className="leading-none"
          >
            {batch.status === 'paused' && batch.pause ? pauseLabel(batch.pause.kind) : batch.status}
          </Stamp>
        </div>
      </div>
    </Card>
  );
};

export const BatchStopControls = ({
  onControl,
}: {
  onControl: (action: 'stop' | 'stop-after-phase' | 'stop-after-idea' | 'skip') => void;
}) => (
  <div className="flex flex-wrap gap-2">
    <Button size="small" variant="ghost" onClick={() => onControl('stop-after-phase')}>
      After this phase
    </Button>
    <Button size="small" variant="ghost" onClick={() => onControl('stop-after-idea')}>
      After this idea
    </Button>
    <Button size="small" variant="ghost" onClick={() => onControl('skip')}>
      Skip this idea
    </Button>
    <Button size="small" variant="danger" onClick={() => onControl('stop')}>
      Stop now
    </Button>
  </div>
);
