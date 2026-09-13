import { ArcGauge, BarChart, EmptyState, StackedBar } from '@/app/components';
import { ENTITY_STATUS_LABEL, ENTITY_STATUS_ORDER } from '@/app/features/stats/constants';
import { surface } from '@/app/styles/tokens';
import { formatTokens } from '@/core/phase-run';
import { Card } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';
import { ENTITY_STATUS_COLOR, SEVERITY_COLOR, SEVERITY_LABEL, SEVERITY_ORDER } from '../constants';
import type { HubNumbers } from '../helpers/hub-numbers';

interface NumberCardProps {
  title: string;
  children: ReactNode;
}

const NumberCard = ({ title, children }: NumberCardProps) => (
  <Card size="small" texture={surface.card}>
    <div className="flex flex-col gap-3">
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
  const { capacity, runsPerWeek, spend, openQuestions, entitiesByStatus, lastNight } = numbers;

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
    <div className="flex flex-col gap-4">
      <NumberCard title="Capacity">
        {capacity ? (
          <div className="flex justify-center gap-4">
            <ArcGauge value={capacity.fiveHour?.utilization ?? 0} max={1} label="5-hour" />
            <ArcGauge
              value={capacity.sevenDay?.utilization ?? 0}
              max={1}
              label="7-day"
              floor={capacity.sevenDayFloorPct / 100}
            />
          </div>
        ) : (
          <EmptyState message="No capacity reported yet." />
        )}
      </NumberCard>

      <NumberCard title="Runs, last 8 weeks">
        {runsPerWeek.length === 0 ? (
          <EmptyState message="No runs yet." />
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

      <NumberCard title="Spend this week">
        <div className="font-handwritten text-lg font-semibold">${spend.costUsd.toFixed(2)}</div>
        <span className="text-2xs opacity-50">
          {formatTokens(spend.tokens)} tokens{changeSuffix(spend.changeVsLastWeekPct)}
        </span>
      </NumberCard>

      <NumberCard title="Waiting on you">
        <div className="font-handwritten text-lg font-semibold">{openQuestions}</div>
        <span className="text-2xs opacity-50">open questions</span>
      </NumberCard>

      <NumberCard title="Ideas in flight">
        {entitySegments.length === 0 ? (
          <EmptyState message="Nothing in flight." />
        ) : (
          <StackedBar segments={entitySegments} />
        )}
      </NumberCard>

      <NumberCard title="Last night">
        {hadNight ? (
          <>
            <span className="text-2xs opacity-50">
              {lastNight.passCount} {lastNight.passCount === 1 ? 'pass' : 'passes'} · $
              {lastNight.costUsd.toFixed(2)}
            </span>
            {severitySegments.length > 0 && <StackedBar segments={severitySegments} />}
          </>
        ) : (
          <EmptyState message="No night run yet." />
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
