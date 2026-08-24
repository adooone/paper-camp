import { Card, ListItem, Stamp } from '@dendelion/paper-ui';
import { openInProject } from './open-in-project';
import { projectLabel } from './project-label';
import { useCrossProjectReviews } from './use-cross-project-reviews';

export const CrossProjectReviewsView = () => {
  const { rows, loading } = useCrossProjectReviews();

  return (
    <Card size="small" texture="kraft" className="flex flex-col gap-2 text-left">
      <p className="m-0 font-semibold">In review</p>
      {loading ? (
        <p className="m-0 text-sm opacity-70">Checking every registered project…</p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-sm opacity-70">Nothing in review across your registered projects.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map(({ runtime, data: plan }) => (
            <ListItem
              key={`${runtime.runtimeUrl}:${plan.id}`}
              size="small"
              onClick={() => openInProject(runtime.runtimeUrl, `/ideas/${plan.id}`)}
              action={
                <Stamp size="small" variant="info">
                  {projectLabel(runtime)}
                </Stamp>
              }
            >
              {plan.title}
            </ListItem>
          ))}
        </div>
      )}
    </Card>
  );
};
