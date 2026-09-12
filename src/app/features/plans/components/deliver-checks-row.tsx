import { GitStashSurface } from '@/app/components';
import { entityLink, entityRouteParam } from '@/app/hooks';
import type { CheckStatus, DeskCheckState } from '@/types/index';
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

const checkTooltip = (check: DeskCheckState) => `${check.cmd}. Click to run.`;

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
    deskChecks,
    anyRunning,
    hasDocIssues,
    consistency,
    docsExpanded,
    setDocsExpanded,
    navigate,
    runDeskCheck,
    linkedPlanFor,
  } = useDeliverChecksRow();

  return (
    <div className="flex flex-col items-center gap-2">
      {
        // Every check stamp is shown (manifest order, Docs last) — a single
        // "Health" summary hid which check is red.
        <div className="flex flex-wrap items-start justify-center gap-2">
          {deskChecks.map((check) => (
            <CheckStamp
              key={check.name}
              label={check.name}
              status={check.status}
              title={checkTooltip(check)}
              anyRunning={anyRunning}
              onClick={() => runDeskCheck(check.name)}
            />
          ))}
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
                          onClick={() => navigate(entityLink(linkedPlan))}
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
