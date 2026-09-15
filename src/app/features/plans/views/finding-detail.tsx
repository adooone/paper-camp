import { fetchNightFindingStaleness } from '@/app/services/content';
import { surface } from '@/app/styles/tokens';
import type { NightSuggestionEntry } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { SEVERITY_STAMP_VARIANT } from './night-report-section';

interface FindingDetailProps {
  finding: NightSuggestionEntry;
}

interface Fact {
  label: string;
  value: string;
}

const FactsGrid = ({ facts }: { facts: Fact[] }) => (
  <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-x-4 gap-y-2">
    {facts.map((fact) => (
      <div key={fact.label} className="flex min-w-0 flex-col">
        <dt className="font-handwritten text-xs font-semibold opacity-[0.45] whitespace-nowrap">
          {fact.label}
        </dt>
        <dd className="m-0 font-handwritten text-base font-semibold whitespace-nowrap">
          {fact.value}
        </dd>
      </div>
    ))}
  </dl>
);

export const FindingDetail = ({ finding }: FindingDetailProps) => {
  const [stale, setStale] = useState<boolean | null>(null);

  useEffect(() => {
    setStale(null);
    fetchNightFindingStaleness(finding)
      .then((result) => setStale(result.stale))
      .catch(() => setStale(null));
  }, [finding]);

  const facts: Fact[] = [
    { label: 'Commit', value: finding.commit.slice(0, 7) },
    { label: 'Date', value: finding.date },
    {
      label: 'File changed since',
      value: stale === null ? 'checking…' : stale ? 'yes' : 'no',
    },
  ];

  return (
    <div>
      <Card size="small" texture={surface.card} className="mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Stamp size="small" variant="neutral">
              {finding.check}
            </Stamp>
            <Stamp size="small" variant={SEVERITY_STAMP_VARIANT[finding.severity]}>
              {finding.severity}
            </Stamp>
            <span className="text-sm opacity-60">{finding.chunk}</span>
            <span className="font-mono text-sm opacity-80">
              {finding.file}
              {finding.line ? `:${finding.line}` : ''}
            </span>
          </div>
          <p className="m-0 text-base leading-[1.7]">{finding.message}</p>
          <div className="border-t border-paper-950/[12%] pt-3">
            <FactsGrid facts={facts} />
          </div>
        </div>
      </Card>
    </div>
  );
};
