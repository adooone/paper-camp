import { fetchCapabilities, fetchConfig, saveConfig } from '@/app/services/system';
import { fontSize, space } from '@/app/styles/tokens';
import {
  AGENT_LABELS,
  type AgentId,
  type CapabilityResult,
  type CapabilityStatus,
} from '@/types/index';
import { Alert, Button, Card, Divider, Stamp, useToast } from '@dendelion/paper-ui';
import { useCallback, useEffect, useState } from 'react';

interface CapabilityMeta {
  label: string;
  unlocks: string;
  fix: (detail: string) => string;
}

function capabilityMeta(id: string): CapabilityMeta {
  if (id === 'git') {
    return {
      label: 'Git',
      unlocks: 'Commits, phase logging, branch creation',
      fix: (detail) =>
        detail.startsWith('Not inside')
          ? 'git init'
          : 'git config user.name "Your Name" && git config user.email you@example.com',
    };
  }
  if (id === 'gh') {
    return {
      label: 'GitHub CLI',
      unlocks: 'PR badges, review flow, fix-review',
      fix: (detail) => {
        if (detail.includes('not found')) return 'Install: https://cli.github.com';
        if (detail.includes('no origin remote')) return 'git remote add origin <url>';
        if (detail.includes('not reachable')) return 'gh repo view';
        return 'gh auth login';
      },
    };
  }
  const agentId = id.slice('agent:'.length) as AgentId;
  return {
    label: `${AGENT_LABELS[agentId]} CLI`,
    unlocks: `Launching ${AGENT_LABELS[agentId]} for phase runs, drafts, and reviews`,
    fix: () => `Install the ${AGENT_LABELS[agentId]} CLI and add it to PATH`,
  };
}

const STATUS_STAMP: Record<CapabilityStatus, { fill: string; text: string; label: string }> = {
  ok: { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66', label: 'Ready' },
  warn: { fill: 'rgba(212, 163, 115, 0.25)', text: '#A67B4F', label: 'Needs attention' },
  missing: { fill: 'rgba(201, 139, 139, 0.25)', text: '#6E3A3A', label: 'Missing' },
};

const CapabilityRow = ({
  result,
  isLast,
  onRecheck,
  rechecking,
}: {
  result: CapabilityResult;
  isLast: boolean;
  onRecheck: (id: string) => void;
  rechecking: boolean;
}) => {
  const meta = capabilityMeta(result.id);
  const stamp = STATUS_STAMP[result.status];
  const fix = result.status !== 'ok' ? meta.fix(result.detail) : null;
  return (
    <>
      <div style={{ paddingBottom: space[3], paddingTop: space[3] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
          <span style={{ flex: 1, fontWeight: 500 }}>{meta.label}</span>
          <Stamp size="small" fillColor={stamp.fill} textColor={stamp.text}>
            {stamp.label}
          </Stamp>
          <Button
            size="small"
            variant="secondary"
            onClick={() => onRecheck(result.id)}
            disabled={rechecking}
          >
            {rechecking ? 'Checking…' : 'Recheck'}
          </Button>
        </div>
        <p style={{ opacity: 0.65, fontSize: fontSize.sm, margin: `${space[1]} 0 0` }}>
          Unlocks: {meta.unlocks}
        </p>
        <p style={{ opacity: 0.5, fontSize: fontSize.sm, margin: `${space[1]} 0 0` }}>
          {result.detail}
        </p>
        {fix && (
          <code
            style={{
              display: 'block',
              marginTop: space[2],
              padding: space[2],
              background: 'rgba(0,0,0,0.06)',
              borderRadius: 4,
              fontSize: fontSize.sm,
            }}
          >
            {fix}
          </code>
        )}
      </div>
      {!isLast && <Divider />}
    </>
  );
};

export const SetupSection = () => {
  const [capabilities, setCapabilities] = useState<CapabilityResult[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadingId, setReloadingId] = useState<string | null>(null);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const { toast } = useToast();

  const applyCapabilities = useCallback((result: CapabilityResult[] | null) => {
    if (result === null) {
      setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    setCapabilities(result);
  }, []);

  useEffect(() => {
    fetchCapabilities().then(applyCapabilities);
    fetchConfig().then((c) => setSetupDismissed(c?.setupDismissed ?? false));
  }, [applyCapabilities]);

  const handleRecheck = async (id: string) => {
    setReloadingId(id);
    applyCapabilities(await fetchCapabilities());
    setReloadingId(null);
  };

  const handleDismissToggle = async () => {
    const next = !setupDismissed;
    const { ok } = await saveConfig({ setupDismissed: next });
    if (ok) {
      setSetupDismissed(next);
      toast({ title: 'Saved', variant: 'success' });
    } else {
      toast({ title: 'Failed to save', variant: 'error' });
    }
  };

  const allOk = capabilities?.every((c) => c.status === 'ok') ?? true;

  return (
    <div>
      <div style={{ marginBottom: space[6] }}>
        <h2 style={{ margin: 0 }}>Setup</h2>
      </div>
      {capabilities === null && !loadFailed && <p>Loading…</p>}
      {loadFailed && (
        <div style={{ marginBottom: space[4] }}>
          <Alert variant="warning">Failed to load capabilities. Try refreshing.</Alert>
        </div>
      )}
      {capabilities && (
        <>
          {!allOk && (
            <div style={{ marginBottom: space[4] }}>
              <Alert variant="warning">
                Some capabilities are incomplete — features that depend on them stay disabled until
                fixed. Run the fix command in your terminal, then recheck.
              </Alert>
            </div>
          )}
          <Card size="small">
            {capabilities.map((c, idx) => (
              <CapabilityRow
                key={c.id}
                result={c}
                isLast={idx === capabilities.length - 1}
                onRecheck={handleRecheck}
                rechecking={reloadingId === c.id}
              />
            ))}
          </Card>
          <div style={{ marginTop: space[4] }}>
            <Button variant="secondary" size="small" onClick={handleDismissToggle}>
              {setupDismissed ? 'Show Setup on open again' : "Don't show Setup on open"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
