import { useAppStore } from '@/app/stores/app-store';
import { deriveBuildStatus } from '@/app/utils/check-status';
import { Card, Stamp, Tooltip } from '@dendelion/paper-ui';
import { chalkStatusFill, chalkStatusText, groupLabelClassName } from './shared';

const statusFill = { ...chalkStatusFill, stale: 'transparent' };
const statusText = { ...chalkStatusText, stale: undefined };

const formatLastBuilt = (lastBuilt: string | null): string =>
  lastBuilt ? `Last built ${new Date(lastBuilt).toLocaleTimeString()}` : 'Never built';

export const BuildGroup = () => {
  const statusData = useAppStore((s) => s.status);
  const runCheck = useAppStore((s) => s.runCheck);
  const { buildStatus, lastBuilt } = deriveBuildStatus(statusData);
  const running = buildStatus === 'running';
  const cmd = statusData?.build?.cmd;

  return (
    <div>
      <div className={groupLabelClassName}>Build</div>
      <Card surface="chalkboard" size="small">
        <div className="flex items-center justify-between gap-2">
          <Tooltip content={`${cmd || 'commands.build'} — click to run.`} surface="chalkboard">
            {/* Raw <button>: the clickable target is a Stamp, which has no button surface of its own. */}
            <button
              type="button"
              className={`inline-flex border-none bg-transparent bg-none p-0 ${running ? 'cursor-not-allowed' : 'cursor-pointer enabled:hover:-translate-y-px enabled:hover:brightness-[1.15]'}`}
              onClick={() => {
                if (!running) runCheck('build');
              }}
              disabled={running}
            >
              <Stamp
                surface="chalkboard"
                size="small"
                fillColor={statusFill[buildStatus]}
                textColor={statusText[buildStatus]}
              >
                build
                <span className={running ? 'visible' : 'invisible'}>…</span>
              </Stamp>
            </button>
          </Tooltip>
          <span className="shrink-0 font-mono text-2xs text-desk-text-muted">
            {formatLastBuilt(lastBuilt)}
          </span>
        </div>
      </Card>
    </div>
  );
};
