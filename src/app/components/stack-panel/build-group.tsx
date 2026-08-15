import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { Stamp, Tooltip } from '@dendelion/paper-ui';
import { chalkStatusFill, chalkStatusText, groupLabelClassName } from './shared';

export const BUILD_GROUP_LABEL = 'Build';

const statusFill = { ...chalkStatusFill, stale: 'transparent' };
const statusText = { ...chalkStatusText, stale: undefined };

const formatLastBuilt = (lastBuilt: string | null): string =>
  lastBuilt ? `Last built ${new Date(lastBuilt).toLocaleTimeString()}` : 'Never built';

// Sourced from `desk.checks[name=build]` (IDEA-162) — the same manifest entry the
// Checks group reads, not a separately tracked `/api/status` field.
export const BuildGroup = () => {
  const { checks, run } = useDeskChecks();
  const build = checks.find((c) => c.name === 'build');
  const buildStatus = build?.status ?? 'stale';
  const running = buildStatus === 'running';
  const unconfigured = !build;

  return (
    <div>
      <div className={groupLabelClassName}>{BUILD_GROUP_LABEL}</div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <Tooltip
            content={
              unconfigured
                ? 'Declare a "build" check in papercamp/config.json — desk.checks.'
                : `${build.cmd} — click to run.`
            }
            surface="chalkboard"
          >
            {/* Raw <button>: the clickable target is a Stamp, which has no button surface of its own. */}
            <button
              type="button"
              className={`inline-flex border-none bg-transparent bg-none p-0 ${running || unconfigured ? 'cursor-not-allowed' : 'cursor-pointer enabled:hover:-translate-y-px enabled:hover:brightness-[1.15]'}`}
              onClick={() => {
                if (!running && !unconfigured) run('build');
              }}
              disabled={running || unconfigured}
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
            {formatLastBuilt(build?.lastRun ?? null)}
          </span>
        </div>
        {unconfigured && (
          <p className="m-0 text-center text-2xs text-desk-text-muted">
            No <code>build</code> check declared — add one to <code>desk.checks</code> in{' '}
            <code>papercamp/config.json</code>.
          </p>
        )}
      </div>
    </div>
  );
};
