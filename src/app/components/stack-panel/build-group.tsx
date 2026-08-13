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
  // A build that never had a command configured looks identical to a failed run
  // (status: 'fail') except cmd stays empty — the signal the server never spawned anything.
  const unconfigured = buildStatus === 'fail' && !cmd;

  return (
    <div>
      <div className={groupLabelClassName}>Build</div>
      <Card surface="chalkboard" size="small">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Tooltip
              content={
                unconfigured
                  ? 'Set commands.build in papercamp/config.json — click to check again.'
                  : `${cmd} — click to run.`
              }
              surface="chalkboard"
            >
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
                  fillColor={unconfigured ? statusFill.stale : statusFill[buildStatus]}
                  textColor={unconfigured ? statusText.stale : statusText[buildStatus]}
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
          {unconfigured && (
            <p className="m-0 text-center text-2xs text-desk-text-muted">
              No build command configured — set <code>commands.build</code> in{' '}
              <code>papercamp/config.json</code>.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
