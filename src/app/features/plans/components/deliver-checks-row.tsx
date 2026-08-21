import { GitStashSurface } from '@/app/components';
import { entityRouteParam } from '@/app/hooks';
import type { CheckStatus } from '@/types/index';
import { Stamp, type StampVariant, Tooltip } from '@dendelion/paper-ui';
import { useDeliverChecksRow } from '../hooks';

const CHECK_VARIANT: Record<CheckStatus, StampVariant> = {
  pass: 'success',
  fail: 'error',
  running: 'warning',
  stale: 'neutral',
};

interface CheckStampProps {
  label: string;
  status: CheckStatus;
  title: string;
  anyRunning: boolean;
  onClick: () => void;
}

const CheckStamp = ({ label, status, title, anyRunning, onClick }: CheckStampProps) => (
  <Tooltip content={title}>
    {/* Raw <button>: the clickable target is a Stamp, so it needs a chrome-less wrapper. */}
    <button
      type="button"
      className={`inline-flex bg-none bg-transparent border-none p-0 enabled:hover:-translate-y-px enabled:hover:brightness-[1.15] enabled:active:translate-y-0 enabled:active:brightness-[0.95] ${anyRunning ? 'cursor-not-allowed' : 'cursor-pointer'} ${anyRunning && status !== 'running' ? 'opacity-50' : 'opacity-100'}`}
      onClick={() => {
        if (!anyRunning) onClick();
      }}
      disabled={anyRunning}
    >
      <Stamp size="small" variant={CHECK_VARIANT[status]}>
        {label}
        <span className={status === 'running' ? 'visible' : 'invisible'}>…</span>
      </Stamp>
    </button>
  </Tooltip>
);

export const DeliverChecksRow = () => {
  const {
    qualityStatus,
    testStatus,
    consistencyStatus,
    anyRunning,
    hasDocIssues,
    consistency,
    docsExpanded,
    setDocsExpanded,
    navigate,
    runDeskCheck,
    runConsistencyCheck,
    linkedPlanFor,
  } = useDeliverChecksRow();

  return (
    <div className="flex flex-col items-center gap-2">
      {
        // Every check stamp is shown. A single "Health" summary hid the one thing
        // worth reading at a glance — which check is red.
        <div className="flex flex-wrap items-start justify-center gap-2">
          <CheckStamp
            label="Quality"
            status={qualityStatus}
            title="Code style & formatting (Biome lint + format). Click to run."
            anyRunning={anyRunning}
            onClick={() => runDeskCheck('lint')}
          />
          <CheckStamp
            label="Tests"
            status={testStatus}
            title="Unit tests (Vitest). Click to run."
            anyRunning={anyRunning}
            onClick={() => runDeskCheck('test')}
          />
          <CheckStamp
            label="Consistency"
            status={consistencyStatus}
            title="Dead code & architecture (Knip + dependency-cruiser). Click to run."
            anyRunning={anyRunning}
            onClick={() => runConsistencyCheck()}
          />
          <div>
            <Tooltip
              content={
                hasDocIssues
                  ? 'Plan/idea doc findings — orphan subjects, title style & stale references. Click to show.'
                  : 'Plan/idea docs — no findings (orphan subjects, title style, stale references).'
              }
            >
              {/* Raw <button>: the clickable target is a Stamp, so it needs a chrome-less wrapper. */}
              <button
                type="button"
                className={`inline-flex bg-none bg-transparent border-none p-0 ${hasDocIssues ? 'enabled:hover:-translate-y-px enabled:hover:brightness-[1.15] enabled:active:translate-y-0 enabled:active:brightness-[0.95] cursor-pointer' : 'cursor-default'}`}
                disabled={!hasDocIssues}
                aria-expanded={hasDocIssues ? docsExpanded : undefined}
                aria-controls="deliver-doc-findings"
                onClick={() => {
                  if (hasDocIssues) setDocsExpanded((prev) => !prev);
                }}
              >
                <Stamp size="small" variant={hasDocIssues ? 'error' : 'success'}>
                  Docs
                </Stamp>
              </button>
            </Tooltip>
            {docsExpanded && hasDocIssues && (
              <div id="deliver-doc-findings" className="mt-2 flex flex-col gap-2">
                {consistency.map((issue, i) => {
                  const linkedPlan = linkedPlanFor(issue);
                  return (
                    <div
                      key={`${issue.kind}-${issue.title}-${i}`}
                      className="font-mono text-2xs opacity-70"
                    >
                      {linkedPlan ? (
                        <button
                          type="button"
                          onClick={() =>
                            navigate({
                              to: '/plans/$planId',
                              params: {
                                planId: entityRouteParam(linkedPlan.id, linkedPlan.title),
                              },
                            })
                          }
                          className="bg-none bg-transparent border-none p-0 underline cursor-pointer [font:inherit] text-left"
                        >
                          {issue.message}
                        </button>
                      ) : (
                        <span className="text-left">{issue.message}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <GitStashSurface />
        </div>
      }
    </div>
  );
};
