import { ArcGauge, BarChart, StackedBar } from '@/app/components';
import { ENTITY_STATUS_LABEL, ENTITY_STATUS_ORDER } from '@/app/features/stats/constants';
import { formatTokens } from '@/core/phase-run';
import { Card, Spinner } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';
import { ENTITY_STATUS_COLOR, SEVERITY_COLOR, SEVERITY_LABEL, SEVERITY_ORDER } from '../constants';
import type { HubNumbers } from '../helpers/hub-numbers';

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-2xs opacity-50">{children}</span>
);

interface NumberCardProps {
  title: string;
  children: ReactNode;
}

// Kraft on the grid, a shade below the sheet's parchment: the numbers read as a
// separate material beside the page rather than a second copy of it.
const NumberCard = ({ title, children }: NumberCardProps) => (
  <Card size="small" texture="kraft">
    <div className="flex flex-col gap-1.5">
      <span className="font-handwritten text-xs font-semibold opacity-[0.55]">{title}</span>
      {children}
    </div>
  </Card>
);

function weekLabel(week: string): string {
  return week.split('-W')[1] ?? week;
}

function changeSuffix(pct: number | null): string {
  if (pct === null) return '';
  const sign = pct > 0 ? '+' : '';
  return ` · ${sign}${Math.round(pct)}% vs last week`;
}

export interface HubNumbersColumnProps {
  numbers: HubNumbers;
}

export const HubNumbersColumn = ({ numbers }: HubNumbersColumnProps) => {
  const { loading, capacity, runsPerWeek, spend, openQuestions, entitiesByStatus, lastNight } =
    numbers;

  const totalRuns = runsPerWeek.reduce((sum, week) => sum + week.total, 0);
  const failedRuns = runsPerWeek.reduce((sum, week) => sum + week.failed, 0);

  const entitySegments = ENTITY_STATUS_ORDER.filter((status) => entitiesByStatus[status]).map(
    (status) => ({
      label: ENTITY_STATUS_LABEL[status],
      value: entitiesByStatus[status] ?? 0,
      color: ENTITY_STATUS_COLOR[status],
    }),
  );

  const severitySegments = SEVERITY_ORDER.filter(
    (severity) => lastNight.findingsBySeverity[severity],
  ).map((severity) => ({
    label: SEVERITY_LABEL[severity],
    value: lastNight.findingsBySeverity[severity] ?? 0,
    color: SEVERITY_COLOR[severity],
  }));

  const hadNight = lastNight.passCount > 0 || severitySegments.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <NumberCard title="Capacity">
        {loading ? (
          <Spinner size="small" />
        ) : capacity ? (
          <div className="flex justify-center gap-3">
            <ArcGauge
              value={capacity.fiveHour?.utilization ?? 0}
              max={1}
              label="5-hour"
              size={68}
            />
            <ArcGauge
              value={capacity.sevenDay?.utilization ?? 0}
              max={1}
              label="7-day"
              size={68}
              floor={capacity.sevenDayFloorPct / 100}
            />
          </div>
        ) : (
          <Muted>No capacity reported yet.</Muted>
        )}
      </NumberCard>

      <NumberCard title="Runs, last 8 weeks">
        {loading ? (
          <Spinner size="small" />
        ) : runsPerWeek.length === 0 ? (
          <Muted>No runs yet.</Muted>
        ) : (
          <>
            <BarChart
              bars={runsPerWeek.map((week) => ({
                label: weekLabel(week.week),
                value: week.total,
                hatchedValue: week.failed,
              }))}
            />
            <span className="text-2xs opacity-50">
              {totalRuns} runs · {failedRuns} failed
            </span>
          </>
        )}
      </NumberCard>

      <div className="grid grid-cols-2 gap-4">
        <NumberCard title="This week">
          {loading ? (
            <Spinner size="small" />
          ) : (
            <>
              <div className="font-handwritten text-lg font-semibold">
                {spend.costUsd > 0 ? `$${spend.costUsd.toFixed(2)}` : formatTokens(spend.tokens)}
              </div>
              <span className="text-2xs opacity-50">
                {spend.costUsd > 0
                  ? `${formatTokens(spend.tokens)} tokens${changeSuffix(spend.changeVsLastWeekPct)}`
                  : 'tokens · no cost reported'}
              </span>
            </>
          )}
        </NumberCard>

        <NumberCard title="Waiting on you">
          {loading ? (
            <Spinner size="small" />
          ) : (
            <>
              <div className="font-handwritten text-lg font-semibold">{openQuestions}</div>
              <span className="text-2xs opacity-50">open questions</span>
            </>
          )}
        </NumberCard>
      </div>

      <NumberCard title="Ideas in flight">
        {loading ? (
          <Spinner size="small" />
        ) : entitySegments.length === 0 ? (
          <Muted>Nothing in flight.</Muted>
        ) : (
          <StackedBar segments={entitySegments} />
        )}
      </NumberCard>

      <NumberCard title="Last night">
        {loading ? (
          <Spinner size="small" />
        ) : hadNight ? (
          <>
            <span className="text-2xs opacity-50">
              {lastNight.passCount} {lastNight.passCount === 1 ? 'pass' : 'passes'}
              {lastNight.costUsd > 0 ? ` · $${lastNight.costUsd.toFixed(2)}` : ''}
            </span>
            {severitySegments.length > 0 && <StackedBar segments={severitySegments} />}
          </>
        ) : (
          <Muted>No night run yet.</Muted>
        )}
      </NumberCard>

      {numbers.totalCount > 0 && (
        <p className="m-0 text-2xs opacity-40">
          Counted {numbers.reachableCount} of {numbers.totalCount} project
          {numbers.totalCount === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
};
