import { useServicesClient } from '@/app/hooks/use-services-client';
import { fetchServiceLog } from '@/app/services/services-api';
import type { ServiceState } from '@/types/index';
import { Card, IconButton, Spinner, useToast } from '@dendelion/paper-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState } from '../empty-state';
import { ChevronRightIcon, RunIcon, StopIcon } from '../icons';
import { groupLabelClassName } from './shared';

const LOG_POLL_MS = 1500;

export const SERVICES_GROUP_LABEL = 'Services';

export const dotClass = (service: ServiceState): string => {
  if (service.status === 'crashed') return 'bg-chalk-fail-text';
  if (service.status === 'running') {
    return service.health === 'up' ? 'bg-chalk-pass-text' : 'bg-chalk-running-text';
  }
  if (service.status === 'stopping') return 'bg-chalk-running-text';
  return 'bg-desk-text-muted';
};

const StatusDot = ({ service }: { service: ServiceState }) => {
  const label = service.status === 'running' ? `running · ${service.health}` : service.status;
  return (
    <span
      role="img"
      aria-label={label}
      className={`h-2 w-2 shrink-0 rounded-full ${dotClass(service)}`}
      title={label}
    />
  );
};

const ServiceLog = ({ name, running }: { name: string; running: boolean }) => {
  const [log, setLog] = useState('');
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await fetchServiceLog(name);
      if (!cancelled) setLog(next);
    };
    load();
    const timer = running ? setInterval(load, LOG_POLL_MS) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [name, running]);

  useEffect(() => {
    const pre = preRef.current;
    if (pre && log) pre.scrollTop = pre.scrollHeight;
  }, [log]);

  return (
    <pre
      ref={preRef}
      className="m-0 mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[8px] bg-desk-bg/60 p-2 font-mono text-2xs leading-relaxed text-desk-text-muted"
    >
      {log || 'No output yet.'}
    </pre>
  );
};

const ServiceRow = ({
  service,
  onStart,
  onStop,
}: {
  service: ServiceState;
  onStart: (name: string) => Promise<void>;
  onStop: (name: string) => Promise<void>;
}) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const isRunning = service.status === 'running' || service.status === 'stopping';
  const owned = service.pid !== null;

  const toggleRun = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await (isRunning ? onStop : onStart)(service.name);
    } catch (err) {
      toast({
        title: isRunning ? 'Failed to stop service' : 'Failed to start service',
        description: (err as Error).message,
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card surface="chalkboard" size="small">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          aria-expanded={showLog}
          className="flex min-w-0 cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left"
        >
          <span
            className={`shrink-0 text-desk-text-muted transition-transform ${showLog ? 'rotate-90' : ''}`}
          >
            <ChevronRightIcon />
          </span>
          <StatusDot service={service} />
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-display-luminari text-sm font-semibold text-desk-chalk">
            {service.name}
          </span>
          {service.port && (
            <span className="shrink-0 font-mono text-2xs text-desk-text-muted">
              :{service.port}
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {busy ? (
            <Spinner size="small" surface="chalkboard" label="Working" />
          ) : !isRunning || owned ? (
            <IconButton
              icon={isRunning ? <StopIcon /> : <RunIcon />}
              surface="chalkboard"
              size="small"
              variant="ghost"
              label={isRunning ? `Stop ${service.name}` : `Start ${service.name}`}
              onClick={toggleRun}
            />
          ) : null}
        </div>
      </div>
      {showLog && <ServiceLog name={service.name} running={isRunning} />}
    </Card>
  );
};

export const ServicesGroup = () => {
  const { services, start, stop } = useServicesClient();
  const onStart = useCallback((name: string) => start(name), [start]);
  const onStop = useCallback((name: string) => stop(name), [stop]);

  return (
    <div>
      <h4 className={`${groupLabelClassName} m-0`}>{SERVICES_GROUP_LABEL}</h4>
      <div className="flex flex-col gap-2">
        {services.length > 0 ? (
          services.map((service) => (
            <ServiceRow key={service.name} service={service} onStart={onStart} onStop={onStop} />
          ))
        ) : (
          <Card surface="chalkboard" size="small">
            <EmptyState message="No services declared." />
          </Card>
        )}
      </div>
    </div>
  );
};
