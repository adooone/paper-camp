import type { StampVariant } from '@dendelion/paper-ui';
import { Card, ListItem, Stamp } from '@dendelion/paper-ui';
import { openInProject } from './open-in-project';
import { projectLabel } from './project-label';
import { useCrossProjectActivity } from './use-cross-project-activity';

const OUTCOME_VARIANT: Record<'done' | 'error' | 'superseded', StampVariant> = {
  done: 'success',
  error: 'error',
  superseded: 'neutral',
};

export const CrossProjectActivityView = () => {
  const { rows, loading } = useCrossProjectActivity();

  return (
    <Card size="small" texture="kraft" className="flex flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Agent activity, last 24 hours</p>
      {loading ? (
        <p className="m-0 text-sm opacity-70">Checking every registered project…</p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-sm opacity-70">No agent runs in the last 24 hours.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map(({ runtime, data: run }) => (
            <ListItem
              key={`${runtime.runtimeUrl}:${run.id}`}
              size="small"
              onClick={() => {
                if (run.planId) openInProject(runtime.runtimeUrl, `/ideas/${run.planId}`);
              }}
              action={
                <Stamp size="small" variant={OUTCOME_VARIANT[run.outcome]}>
                  {run.outcome}
                </Stamp>
              }
            >
              <span className="flex flex-col gap-0.5 text-left">
                <span>{run.planTitle}</span>
                <span className="font-handwritten text-2xs opacity-60">
                  {projectLabel(runtime)}
                </span>
              </span>
            </ListItem>
          ))}
        </div>
      )}
    </Card>
  );
};
