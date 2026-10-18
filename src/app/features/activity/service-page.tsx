import { ServiceActionButtons } from '@/app/components/stack-panel/services-group';
import { useServicesClient } from '@/app/hooks/use-services-client';
import { fetchServiceLog } from '@/app/services/services-api';
import { useAppStore } from '@/app/stores/app-store';
import { type ServiceTone, serviceStatus } from '@/core/service-status';
import type { ServiceState } from '@/types/index';
import {
  Button,
  EmptyState,
  type FactItem,
  FactsGrid,
  Stamp,
  type StampVariant,
} from '@dendelion/folk-ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect } from 'react';
import { pageClass } from './activity-entry-page';
import { formatFullTimestamp } from './helpers';
import { useLiveLines } from './hooks/use-live-lines';
import { LogOutputPane } from './views';

const STAMP_VARIANT: Record<ServiceTone, StampVariant> = {
  muted: 'muted',
  running: 'warning',
  pass: 'success',
  fail: 'error',
};

export const serviceFacts = (service: ServiceState): FactItem[] => {
  const facts: FactItem[] = [{ label: 'Command', value: service.cmd }];
  if (service.pid !== null) facts.push({ label: 'PID', value: String(service.pid) });
  if (service.startedAt) {
    facts.push({ label: 'Started', value: formatFullTimestamp(service.startedAt) });
  }
  if (service.hasHealthcheck) facts.push({ label: 'Health', value: service.health });
  if (service.exitCode !== null)
    facts.push({ label: 'Last exit', value: String(service.exitCode) });
  return facts;
};

const ServiceSwitcher = ({ services, active }: { services: ServiceState[]; active: string }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {services.map((service) => (
        <Button
          key={service.name}
          variant="ghost"
          size="small"
          isActive={service.name === active}
          onClick={() =>
            navigate({ to: '/activity/services/$name', params: { name: service.name } })
          }
        >
          {service.name}
        </Button>
      ))}
    </div>
  );
};

export const ServicePage = () => {
  const { name } = useParams({ from: '/activity/services/$name' });
  const client = useServicesClient();
  const service = client.services.find((s) => s.name === name);
  const setActiveLogEntryTitle = useAppStore((s) => s.setActiveLogEntryTitle);
  const navigate = useNavigate();
  const live = service?.status === 'running' || service?.status === 'stopping';
  const fetcher = useCallback(() => fetchServiceLog(name), [name]);
  const { lines, failed, retry } = useLiveLines(fetcher, live);
  const title = service?.name ?? null;

  useEffect(() => {
    setActiveLogEntryTitle(title);
  }, [title, setActiveLogEntryTitle]);

  if (!service) {
    return (
      <EmptyState
        message="This entry doesn't exist."
        action={
          <Button size="small" onClick={() => navigate({ to: '/activity' })}>
            Back to Activity
          </Button>
        }
      />
    );
  }

  const { word, tone } = serviceStatus(service);

  return (
    <div className={pageClass}>
      <ServiceSwitcher services={client.services} active={service.name} />
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 mr-1 font-serif text-lg font-semibold">{service.name}</h1>
          {service.port && (
            <a
              href={`http://localhost:${service.port}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-desk-text-muted"
            >
              :{service.port}
            </a>
          )}
          <Stamp size="small" variant={STAMP_VARIANT[tone]}>
            {word}
          </Stamp>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ServiceActionButtons service={service} client={client} />
          </div>
        </div>
        <FactsGrid items={serviceFacts(service)} layout="inline" />
      </div>
      <LogOutputPane lines={lines} failed={failed} onRetry={retry} live={live} />
    </div>
  );
};
