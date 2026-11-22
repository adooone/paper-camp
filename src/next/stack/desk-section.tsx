import { useToast } from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type ServiceAction, serviceActions } from '@/app/components/stack-panel/services-group';
import { formatLastRun } from '@/app/components/stack-panel/shared';
import { useCiRelease } from '@/app/hooks/use-ci-release';
import { type DeskDiscoveryState, useDeskDiscovery } from '@/app/hooks/use-desk-discovery';
import { useServicesClient } from '@/app/hooks/use-services-client';
import { serviceStatus } from '@/core/service-status';
import type { ServiceState } from '@/types/index';
import { SCREEN_PATHS } from '../shell/screens';
import { ciView, deskChangeLines } from '../shell/stack-model';
import { Button } from '../ui/button';
import { Sheet } from '../ui/sheet';
import { ChalkCard, ChalkLabel, ToneDot } from './chalk';
import styles from './stack.module.css';

const ACTION_LABELS: Record<ServiceAction, string> = {
  start: 'Start',
  stop: 'Stop',
  restart: 'Restart',
};

function ServiceRow({
  service,
  run,
}: {
  service: ServiceState;
  run: (service: ServiceState, action: ServiceAction) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const { word, tone } = serviceStatus(service);
  const act = async (action: ServiceAction) => {
    if (busy) return;
    setBusy(true);
    try {
      await run(service, action);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.service}>
      <div className={styles.line}>
        <ToneDot tone={tone} label={word} />
        <span className={styles.lineName}>{service.name}</span>
        {service.port ? (
          <a
            href={`http://localhost:${service.port}`}
            target="_blank"
            rel="noreferrer"
            className={`${styles.mono} ${styles.lineLink}`}
          >
            :{service.port}
          </a>
        ) : null}
        <span className={styles.mono}>{word}</span>
      </div>
      <div className={styles.actions}>
        {serviceActions(service).map((action) => (
          <Button
            key={action}
            label={busy ? 'Working…' : ACTION_LABELS[action]}
            accessibilityLabel={`${ACTION_LABELS[action]} ${service.name}`}
            variant="secondary"
            size="xs"
            disabled={busy}
            onPress={() => act(action)}
          />
        ))}
      </div>
    </div>
  );
}

function ServicesBlock() {
  const client = useServicesClient();
  const { toast } = useToast();
  const run = async (service: ServiceState, action: ServiceAction) => {
    try {
      await client[action](service.name);
    } catch (error) {
      toast({
        title: `Failed to ${action} service`,
        description: (error as Error).message,
        variant: 'error',
      });
    }
  };
  return (
    <section className={styles.section} aria-label="Services">
      <ChalkLabel>Services</ChalkLabel>
      <ChalkCard>
        {client.services.length > 0 ? (
          client.services.map((service) => (
            <ServiceRow key={service.name} service={service} run={run} />
          ))
        ) : (
          <span className={styles.muted}>No services declared.</span>
        )}
      </ChalkCard>
    </section>
  );
}

function CiBlock() {
  const { ci, loading, refresh } = useCiRelease();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const view = ciView(ci);
  const reload = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <section className={styles.section} aria-label="CI and release">
      <ChalkLabel
        side={
          ci ? (
            <>
              <span className={styles.mono}>{formatLastRun(ci.fetchedAt)}</span>
              <Button
                label={refreshing ? 'Refreshing…' : 'Refresh'}
                accessibilityLabel="Refresh CI"
                variant="ghost"
                size="xs"
                disabled={refreshing}
                onPress={reload}
              />
            </>
          ) : undefined
        }
      >
        CI & release
      </ChalkLabel>
      <ChalkCard>
        {loading ? <span className={styles.muted}>Loading…</span> : null}
        {!loading && view.kind === 'none' ? (
          <span className={styles.muted}>No CI source declared.</span>
        ) : null}
        {view.kind === 'unavailable' ? (
          <span className={styles.muted}>GitHub unavailable.</span>
        ) : null}
        {view.kind === 'ready' ? (
          <>
            {view.runsUnreadable ? <span className={styles.muted}>couldn't read runs</span> : null}
            {!view.runsUnreadable && view.lines.length === 0 ? (
              <span className={styles.muted}>No recent runs on {view.branch}.</span>
            ) : null}
            {view.lines.map((line) => {
              const body = (
                <>
                  <ToneDot tone={line.tone} label={line.word} />
                  <span className={styles.lineName}>{line.name}</span>
                  <span className={styles.mono}>{line.word}</span>
                </>
              );
              if (line.opensSettings) {
                return (
                  <button
                    key={`${line.name}:${line.word}`}
                    type="button"
                    onClick={() => void navigate({ to: SCREEN_PATHS.settings })}
                    className={`${styles.line} ${styles.open}`}
                  >
                    {body}
                  </button>
                );
              }
              return line.href ? (
                <a
                  key={`${line.name}:${line.word}`}
                  href={line.href}
                  target="_blank"
                  rel="noreferrer"
                  title={line.tooltip}
                  className={`${styles.line} ${styles.lineLink}`}
                >
                  {body}
                </a>
              ) : (
                <div key={`${line.name}:${line.word}`} className={styles.line} title={line.tooltip}>
                  {body}
                </div>
              );
            })}
            {view.releaseUrl ? (
              <a
                href={view.releaseUrl}
                target="_blank"
                rel="noreferrer"
                className={`${styles.mono} ${styles.lineLink}`}
              >
                {view.version}
              </a>
            ) : (
              <span className={styles.mono}>{view.version}</span>
            )}
          </>
        ) : null}
      </ChalkCard>
    </section>
  );
}

function DiscoverBlock({ desk }: { desk: DeskDiscoveryState }) {
  const [applying, setApplying] = useState(false);
  const changes = desk.diff ? deskChangeLines(desk.diff) : [];
  const apply = async () => {
    if (!desk.proposal) return;
    setApplying(true);
    await desk
      .applyProposal(desk.proposal)
      .catch(() => undefined)
      .finally(() => setApplying(false));
  };
  return (
    <>
      <div className={styles.empty}>
        <span className={`${styles.muted} ${styles.wrap}`}>
          Desk isn't configured — scan the project for one-click checks and long-running services.
        </span>
        <Button
          label={desk.discovering ? 'Discovering…' : 'Discover from project'}
          size="sm"
          disabled={desk.discovering}
          onPress={desk.startDiscovery}
        />
      </div>
      <Sheet
        visible={desk.proposal !== null}
        onRequestClose={desk.cancelProposal}
        chalk
        label="Desk proposal"
      >
        <div className={styles.sheetBody}>
          <ChalkLabel>Proposed desk</ChalkLabel>
          {changes.length === 0 ? (
            <span className={styles.muted}>Nothing to change.</span>
          ) : (
            changes.map((line) => (
              <div key={line.key} className={styles.line}>
                <span className={styles.mono}>{line.mark}</span>
                <span className={styles.lineName}>{line.text}</span>
                <span className={styles.mono}>{line.area}</span>
              </div>
            ))
          )}
          <div className={styles.actions}>
            <Button label="Cancel" variant="secondary" size="sm" onPress={desk.cancelProposal} />
            <Button
              label={applying ? 'Applying…' : 'Apply'}
              size="sm"
              disabled={applying}
              onPress={apply}
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}

export function DeskSection() {
  const desk = useDeskDiscovery();
  if (!desk.configLoaded) return <span className={styles.muted}>Loading desk…</span>;
  if (!desk.current) return <DiscoverBlock desk={desk} />;
  return (
    <>
      <ServicesBlock />
      <CiBlock />
    </>
  );
}
