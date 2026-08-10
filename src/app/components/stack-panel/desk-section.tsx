import { useDeskManifest } from '@/app/hooks/use-desk-manifest';
import type { DeskCheck, DeskCi, DeskService } from '@/types/index';
import { Accordion, Card, Divider } from '@dendelion/paper-ui';
import { useState } from 'react';

const DESK_EXPANDED_KEY = 'desk-section-expanded';

const readExpanded = (): boolean => {
  try {
    return localStorage.getItem(DESK_EXPANDED_KEY) === 'true';
  } catch {
    return false;
  }
};

const writeExpanded = (value: boolean): void => {
  try {
    localStorage.setItem(DESK_EXPANDED_KEY, String(value));
  } catch {
    // localStorage unavailable (e.g. private browsing) — keep the in-memory value only
  }
};

const groupLabelClassName =
  'font-display-luminari text-xs font-semibold uppercase tracking-wide text-desk-text-muted mb-2';

const InertRow = ({ primary, secondary }: { primary: string; secondary?: string }) => (
  <Card surface="chalkboard" size="small">
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-display-luminari text-sm font-semibold text-desk-chalk">
        {primary}
      </span>
      {secondary && (
        <span className="shrink-0 font-mono text-2xs text-desk-text-muted">{secondary}</span>
      )}
    </div>
  </Card>
);

const EmptyRow = ({ label }: { label: string }) => (
  <Card surface="chalkboard" size="small">
    <p className="m-0 text-center text-xs opacity-50">{label}</p>
  </Card>
);

const ServicesGroup = ({ services }: { services: DeskService[] }) => (
  <div>
    <div className={groupLabelClassName}>Services</div>
    <div className="flex flex-col gap-2">
      {services.length > 0 ? (
        services.map((service) => (
          <InertRow
            key={service.name}
            primary={service.name}
            secondary={service.port ? `:${service.port}` : undefined}
          />
        ))
      ) : (
        <EmptyRow label="No services declared." />
      )}
    </div>
  </div>
);

const ChecksGroup = ({ checks }: { checks: DeskCheck[] }) => (
  <div>
    <div className={groupLabelClassName}>Checks</div>
    <div className="flex flex-col gap-2">
      {checks.length > 0 ? (
        checks.map((check) => <InertRow key={check.name} primary={check.name} />)
      ) : (
        <EmptyRow label="No checks declared." />
      )}
    </div>
  </div>
);

const CiGroup = ({ ci }: { ci?: DeskCi }) => (
  <div>
    <div className={groupLabelClassName}>CI &amp; release</div>
    <div className="flex flex-col gap-2">
      {ci ? (
        <InertRow primary={ci.repo} secondary={ci.branch ?? undefined} />
      ) : (
        <EmptyRow label="No CI source declared." />
      )}
    </div>
  </div>
);

export const DeskSection = () => {
  const { desk, loading } = useDeskManifest();
  const [expanded, setExpanded] = useState(readExpanded);

  if (loading || !desk) return null;

  const toggle = () => {
    const next = !expanded;
    writeExpanded(next);
    setExpanded(next);
  };

  return (
    <>
      <Divider surface="chalkboard" />
      <div className="p-6">
        <Accordion title="Desk" surface="chalkboard" expanded={expanded} onToggle={toggle}>
          <div className="flex flex-col gap-4">
            <ServicesGroup services={desk.services ?? []} />
            <ChecksGroup checks={desk.checks ?? []} />
            <CiGroup ci={desk.ci} />
          </div>
        </Accordion>
      </div>
    </>
  );
};
