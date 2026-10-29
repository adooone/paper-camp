import { BatchStopControls } from '@/app/components/stack-panel/batch-task-card';
import { CapacityRow } from '@/app/components/stack-panel/capacity-row';
import { useBranchSync } from '@/app/hooks/use-branch-sync';
import { entityLink } from '@/app/hooks/use-route-selection';
import type { BatchPreviewItem } from '@/app/services/batch-api';
import { patchEntity } from '@/app/services/content';
import { refreshPlans } from '@/app/services/query-client';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { BatchRunPauseReason, BatchRunRules } from '@/core/batch-run';
import { DEFAULT_NIGHT_CONFIG } from '@/types/index';
import {
  Button,
  Checkbox,
  Disclosure,
  Input,
  Modal,
  RadioGroup,
  SettingGroup,
  SettingRow,
  Stamp,
  Tooltip,
  useToast,
} from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { resolveConflict } from '../../../services/git-api';

const gitLevelCopy: Record<string, string> = {
  clean: 'Clean',
  behind: 'Behind origin',
  diverged: 'Diverged from origin',
  dirty: 'Uncommitted changes',
};

const formatCost = (usd: number | null): string =>
  usd === null ? '—' : `$${usd < 0.01 && usd > 0 ? '<0.01' : usd.toFixed(2)}`;

// datetime-local has no timezone of its own — reading it back with the same local
// Date constructor it was written with round-trips exactly.
const msToLocalInput = (ms: number | undefined): string =>
  ms === undefined
    ? ''
    : new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const localInputToMs = (value: string): number | undefined =>
  value ? new Date(value).getTime() : undefined;

const PreviewRow = ({
  item,
  checked,
  onToggle,
  onOpenReason,
  onDrop,
}: {
  item: BatchPreviewItem;
  checked: boolean;
  onToggle: () => void;
  onOpenReason?: () => void;
  onDrop: (draggedId: string) => void;
}) => (
  <div
    className="flex items-center gap-2 border-ink-100 border-b py-2 last:border-b-0"
    onDragOver={(e) => e.preventDefault()}
    onDrop={(e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== item.id) onDrop(draggedId);
    }}
  >
    <span
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
      className="flex w-5 shrink-0 cursor-grab select-none justify-center opacity-50"
      aria-hidden
    >
      ≡
    </span>
    <Checkbox
      checked={checked}
      disabled={!item.readiness.ready}
      onChange={onToggle}
      aria-label={`Run ${item.id}`}
    />
    <span className="min-w-0 flex-1 truncate font-handwritten text-sm">
      {item.id} — {item.title}
    </span>
    <span className="shrink-0 text-xs opacity-60">{item.phaseCount} phase(s)</span>
    <span className="w-16 shrink-0 text-right text-xs opacity-60">
      {formatCost(item.costEstimateUsd)}
    </span>
    {item.readiness.ready ? (
      <Stamp size="small" variant="success">
        ready
      </Stamp>
    ) : onOpenReason ? (
      <Button variant="link" size="tiny" onClick={onOpenReason}>
        {item.readiness.message}
      </Button>
    ) : (
      <Stamp size="small" variant="muted">
        {item.readiness.message}
      </Stamp>
    )}
  </div>
);

const RulesSection = ({
  rules,
  onChange,
}: {
  rules: Partial<BatchRunRules>;
  onChange: (next: Partial<BatchRunRules>) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Disclosure expanded={expanded} onToggle={() => setExpanded((v) => !v)}>
        Rules
      </Disclosure>
      {expanded && (
        <SettingGroup title="Rules">
          <SettingRow
            label="Pick up newly unblocked ideas"
            control={
              <Checkbox
                checked={rules.pickupUnblocked ?? true}
                onChange={(e) => onChange({ pickupUnblocked: e.target.checked })}
              />
            }
          />
          <SettingRow
            label="5h ceiling %"
            control={
              <Input
                type="number"
                min={0}
                max={100}
                size="small"
                placeholder={String(DEFAULT_NIGHT_CONFIG.ceiling)}
                value={rules.ceiling ?? ''}
                onChange={(e) =>
                  onChange({ ceiling: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            }
          />
          <SettingRow
            label="7d floor %"
            control={
              <Input
                type="number"
                min={0}
                max={100}
                size="small"
                placeholder={String(DEFAULT_NIGHT_CONFIG.floor)}
                value={rules.floor ?? ''}
                onChange={(e) =>
                  onChange({ floor: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            }
          />
          <SettingRow
            label="On 5h ceiling"
            control={
              <RadioGroup
                value={rules.onCeiling ?? 'wait'}
                onChange={(value) => onChange({ onCeiling: value as 'wait' | 'stop' })}
                options={[
                  { value: 'wait', label: 'Wait for the reset' },
                  { value: 'stop', label: 'Stop the batch' },
                ]}
              />
            }
          />
          <SettingRow
            label="Stop by"
            control={
              <Input
                type="datetime-local"
                size="small"
                value={msToLocalInput(rules.stopAtMs)}
                onChange={(e) => onChange({ stopAtMs: localInputToMs(e.target.value) })}
              />
            }
          />
          <SettingRow
            label="At most N ideas"
            control={
              <Input
                type="number"
                min={1}
                size="small"
                value={rules.maxIdeas ?? ''}
                onChange={(e) =>
                  onChange({ maxIdeas: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            }
          />
          <SettingRow
            label="At most $X"
            control={
              <Input
                type="number"
                min={0}
                step={0.5}
                size="small"
                value={rules.maxCostUsd ?? ''}
                onChange={(e) =>
                  onChange({ maxCostUsd: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            }
          />
          <SettingRow
            label="Branch per idea"
            hint="Cut idea/IDEA-N from main instead of committing straight to it"
            control={
              <Checkbox
                checked={rules.branchPerIdea ?? false}
                onChange={(e) => onChange({ branchPerIdea: e.target.checked })}
              />
            }
          />
        </SettingGroup>
      )}
    </div>
  );
};

const pauseBannerCopy = (pause: BatchRunPauseReason): { title: string; action: string } | null => {
  switch (pause.kind) {
    case 'capacity-ceiling':
      return {
        title: pause.resetsAt
          ? `Waiting for the 5h reset at ${new Date(pause.resetsAt).toLocaleTimeString()}`
          : 'Waiting for the 5h reset',
        action: 'Resume now',
      };
    // No launch route resumes a batch straight into another fix attempt for these two
    // (that loop already ran inside runIdea) — resuming here only skips past it.
    case 'failed-dirty':
      return { title: `${pause.id} failed and left the tree dirty`, action: 'Skip and continue' };
    case 'red-checks':
      return {
        title: `${pause.id} finished but checks are still red`,
        action: 'Skip and continue',
      };
    case 'auth':
      return { title: `${pause.id} needs you signed back in`, action: 'Sign in' };
    case 'conflict':
      return {
        title: `${pause.id} hit a conflict syncing with origin`,
        action: 'Resolve with agent',
      };
    default:
      return null;
  }
};

const RecoveryBanner = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const batchStatus = useAppStore((s) => s.batchStatus);
  const resumeBatch = useAppStore((s) => s.resumeBatch);
  const endBatch = useAppStore((s) => s.endBatch);
  const batch = batchStatus?.batch;
  const [busy, setBusy] = useState(false);

  if (!batch) return null;
  if (batch.status === 'interrupted') {
    return (
      <div className="flex items-center justify-between gap-2 rounded border border-watercolor-amber-dark/40 bg-watercolor-amber-light/30 p-2">
        <span className="text-sm">A daemon restart interrupted this batch mid-run.</span>
        <Button
          size="small"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await resumeBatch();
            } catch (err) {
              toast({
                title: 'Could not resume',
                description: oneLineErrorSummary((err as Error).message),
                variant: 'error',
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          Resume
        </Button>
      </div>
    );
  }
  const pause = batch.pause;
  if (batch.status !== 'paused' || !pause) return null;
  const copy = pauseBannerCopy(pause);
  if (!copy) return null;

  const handleAction = async () => {
    setBusy(true);
    try {
      if (pause.kind === 'auth') {
        navigate({ to: '/project/settings/$section', params: { section: 'setup' } });
      } else if (pause.kind === 'conflict') {
        const result = await resolveConflict(pause.conflictPrompt);
        if (!result.ok)
          throw new Error(result.error ?? 'Could not start the resolve-conflict agent');
      } else {
        await resumeBatch();
      }
    } catch (err) {
      toast({
        title: 'Action failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded border border-watercolor-amber-dark/40 bg-watercolor-amber-light/30 p-2">
      <span className="text-sm">{copy.title}</span>
      <span className="flex shrink-0 gap-2">
        <Button size="small" disabled={busy} onClick={handleAction}>
          {copy.action}
        </Button>
        {pause.kind === 'conflict' && (
          <>
            <Button size="small" variant="ghost" onClick={() => navigate({ to: '/git' })}>
              Open git
            </Button>
            <Button
              size="small"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await endBatch();
                } catch (err) {
                  toast({
                    title: 'Could not end the queue',
                    description: oneLineErrorSummary((err as Error).message),
                    variant: 'error',
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              End batch
            </Button>
          </>
        )}
      </span>
    </div>
  );
};

const LiveView = () => {
  const batchStatus = useAppStore((s) => s.batchStatus);
  const controlBatch = useAppStore((s) => s.controlBatch);
  const batch = batchStatus?.batch;
  const task = batchStatus?.task;
  const ideaTask = batchStatus?.ideaTask;
  if (!batch) return null;

  const total = batch.initialIds.length;
  const done = batch.items.filter(
    (item) => item.outcome !== 'queued' && item.outcome !== 'running',
  ).length;
  const running = batch.items.find((item) => item.outcome === 'running');
  const lastLine =
    ideaTask?.lines?.[ideaTask.lines.length - 1] ?? task?.lines?.[task.lines.length - 1];

  const terminal = batch.status === 'done';

  return (
    <div className="flex flex-col gap-4">
      <RecoveryBanner />
      {!terminal && (
        <div className="flex items-center justify-between gap-2">
          <span className="font-handwritten text-sm">
            {done} of {total} done
            {running ? ` — ${running.id} (${lastLine ?? '…'})` : ''}
          </span>
          <BatchStopControls onControl={controlBatch} />
        </div>
      )}
      {!terminal && <CapacityRow />}
      <div className="flex flex-col gap-1">
        {batch.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              {item.id} — {item.title || item.id}
            </span>
            <Stamp size="small" variant={outcomeVariant(item.outcome)}>
              {item.outcome}
              {item.reason ? `: ${item.reason}` : ''}
            </Stamp>
          </div>
        ))}
      </div>
      {terminal && (
        <div className="flex flex-col gap-1 border-ink-100 border-t pt-2 text-sm">
          <span>
            {batch.ideasRun} idea(s) run · {formatCost(batch.costUsd)}
          </span>
        </div>
      )}
    </div>
  );
};

function outcomeVariant(outcome: string): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  switch (outcome) {
    case 'review':
      return 'success';
    case 'queued':
      return 'neutral';
    case 'running':
      return 'info';
    case 'needs-you':
    case 'needs-human':
    case 'skipped':
    case 'stopped':
      return 'warning';
    default:
      return 'error';
  }
}

export const BatchSheet = () => {
  const open = useAppStore((s) => s.batchSheetOpen);
  const close = useAppStore((s) => s.closeBatchSheet);
  const preview = useAppStore((s) => s.batchPreview);
  const loadBatchPreview = useAppStore((s) => s.loadBatchPreview);
  const batchStatus = useAppStore((s) => s.batchStatus);
  const loadBatchStatus = useAppStore((s) => s.loadBatchStatus);
  const startBatch = useAppStore((s) => s.startBatch);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { handlePull, handleFixDivergence, pulling, fixingDivergence } = useBranchSync();

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [rules, setRules] = useState<Partial<BatchRunRules>>({});
  const [starting, setStarting] = useState(false);

  const batch = batchStatus?.batch;
  const isLive =
    batch &&
    (batch.status === 'running' || batch.status === 'paused' || batch.status === 'interrupted');

  // Snapshotted on open, like draft-all-modal: ticks every ready idea by default.
  // biome-ignore lint/correctness/useExhaustiveDependencies: preview/batchStatus are read as of the open transition.
  useEffect(() => {
    if (!open) return;
    loadBatchPreview();
    loadBatchStatus();
  }, [open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only seeds ticks once preview arrives.
  useEffect(() => {
    if (open && preview && checked.size === 0 && !isLive) {
      setChecked(
        new Set(preview.order.filter((item) => item.readiness.ready).map((item) => item.id)),
      );
    }
  }, [open, preview]);

  if (!open) return null;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reorder = async (draggedId: string, targetIndex: number) => {
    try {
      await patchEntity(draggedId, { order: targetIndex + 1 });
      await Promise.all([refreshPlans(), loadBatchPreview()]);
    } catch (err) {
      toast({
        title: 'Could not reorder',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };

  const orderedChecked = (preview?.order ?? []).filter((item) => checked.has(item.id));
  const totalPhases = orderedChecked.reduce((sum, item) => sum + item.phaseCount, 0);
  const totalCost = orderedChecked.reduce((sum, item) => sum + (item.costEstimateUsd ?? 0), 0);

  const gitLevel = preview?.git.level ?? 'clean';
  const needsSync = gitLevel === 'behind' || gitLevel === 'diverged';

  const handleRun = async () => {
    if (needsSync) {
      if (gitLevel === 'behind') await handlePull();
      else await handleFixDivergence();
      await loadBatchPreview();
      return;
    }
    setStarting(true);
    try {
      await startBatch([...checked], rules);
      await loadBatchStatus();
    } catch (err) {
      toast({
        title: 'Could not start the queue',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Run queue" size="large">
      <div className="flex flex-col gap-4">
        {preview && (
          <div className="flex items-center justify-between gap-2 text-sm opacity-80">
            <span>{gitLevelCopy[gitLevel] ?? gitLevel}</span>
            <span>
              {preview.readyCount} of {preview.order.length} ready
            </span>
          </div>
        )}
        {isLive ? (
          <LiveView />
        ) : (
          <>
            <div className="flex max-h-[20rem] flex-col overflow-y-auto">
              {(preview?.order ?? []).map((item, index) => (
                <PreviewRow
                  key={item.id}
                  item={item}
                  checked={checked.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  onOpenReason={
                    !item.readiness.ready && item.readiness.reason === 'open-question'
                      ? () => navigate(entityLink({ id: item.id, title: item.title }))
                      : undefined
                  }
                  onDrop={(draggedId) => reorder(draggedId, index)}
                />
              ))}
            </div>
            <RulesSection rules={rules} onChange={(next) => setRules((r) => ({ ...r, ...next }))} />
            <div className="flex items-center justify-between gap-2">
              <span className="font-handwritten text-sm opacity-80">
                Run {checked.size} idea{checked.size === 1 ? '' : 's'} · {totalPhases} phase(s) · ~
                {formatCost(totalCost)}
              </span>
              <Tooltip content={checked.size === 0 ? 'Tick at least one idea' : undefined}>
                <Button
                  variant="primary"
                  disabled={checked.size === 0 || starting || pulling || fixingDivergence}
                  onClick={handleRun}
                >
                  {needsSync
                    ? pulling || fixingDivergence
                      ? 'Syncing…'
                      : 'Sync first'
                    : starting
                      ? 'Starting…'
                      : 'Run'}
                </Button>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
