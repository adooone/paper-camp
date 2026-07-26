import { applyMergePolicy, fetchMergePolicy } from '@/app/services/system';
import { space } from '@/app/styles/tokens';
import type { MergePolicy, MergePolicyResult } from '@/types/index';
import { Alert, Button, Card, Divider, Stamp, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

const RECOMMENDED: MergePolicy = {
  allowSquashMerge: true,
  allowMergeCommit: false,
  allowRebaseMerge: false,
  squashMergeCommitTitle: 'PR_TITLE',
  squashMergeCommitMessage: 'PR_BODY',
};

const POLICY_ROWS: { key: keyof MergePolicy; label: string }[] = [
  { key: 'allowSquashMerge', label: 'Allow squash merge' },
  { key: 'allowMergeCommit', label: 'Allow merge commit' },
  { key: 'allowRebaseMerge', label: 'Allow rebase merge' },
  { key: 'squashMergeCommitTitle', label: 'Squash commit title' },
  { key: 'squashMergeCommitMessage', label: 'Squash commit message' },
];

function formatValue(value: boolean | string): string {
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
}

function matchesRecommended(policy: MergePolicy): boolean {
  return POLICY_ROWS.every((row) => policy[row.key] === RECOMMENDED[row.key]);
}

interface PolicyRowProps {
  label: string;
  current: boolean | string;
  recommended: boolean | string;
  isLast: boolean;
}

const PolicyRow = ({ label, current, recommended, isLast }: PolicyRowProps) => {
  const matches = current === recommended;
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[3],
          paddingBottom: space[2],
          paddingTop: space[2],
        }}
      >
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{ opacity: matches ? 0.65 : 1, fontWeight: matches ? 400 : 600 }}>
          {formatValue(current)}
        </span>
        {!matches && <span style={{ opacity: 0.45 }}>→ {formatValue(recommended)}</span>}
      </div>
      {!isLast && <Divider />}
    </>
  );
};

export const MergePolicySection = () => {
  const [result, setResult] = useState<MergePolicyResult | null | undefined>(undefined);
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMergePolicy().then(setResult);
  }, []);

  const handleApply = async () => {
    setApplying(true);
    const applied = await applyMergePolicy();
    setApplying(false);
    if (applied?.status === 'ok') {
      setResult(applied);
      toast({ title: 'Merge policy applied', variant: 'success' });
    } else {
      toast({
        title: 'Failed to apply merge policy',
        description: applied?.status === 'unavailable' ? applied.reason : undefined,
        variant: 'error',
      });
    }
  };

  const upToDate = result?.status === 'ok' && matchesRecommended(result.policy);

  return (
    <div>
      <div style={{ marginBottom: space[6] }}>
        <h2 style={{ margin: 0 }}>Merge Policy</h2>
        <p style={{ opacity: 0.5, marginTop: space[1] }}>
          Paper Camp's canonical policy: squash-only merges, with the commit title and body taken
          from the PR.
        </p>
      </div>
      {result === undefined && <p>Loading…</p>}
      {result === null && <Alert variant="warning">Failed to load merge policy.</Alert>}
      {result?.status === 'unavailable' && <Alert variant="warning">{result.reason}</Alert>}
      {result?.status === 'ok' && (
        <>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: space[3], marginBottom: space[3] }}
          >
            <span style={{ fontWeight: 500 }}>{result.repo}</span>
            <Stamp
              size="small"
              fillColor={upToDate ? 'rgba(143, 185, 150, 0.25)' : 'rgba(212, 163, 115, 0.25)'}
              textColor={upToDate ? '#5E8A66' : '#A67B4F'}
            >
              {upToDate ? 'Matches recommended policy' : 'Differs from recommended policy'}
            </Stamp>
          </div>
          <Card size="small">
            {POLICY_ROWS.map((row, idx) => (
              <PolicyRow
                key={row.key}
                label={row.label}
                current={result.policy[row.key]}
                recommended={RECOMMENDED[row.key]}
                isLast={idx === POLICY_ROWS.length - 1}
              />
            ))}
          </Card>
          <div style={{ marginTop: space[4] }}>
            <Button size="small" onClick={handleApply} disabled={applying || upToDate}>
              {applying ? 'Applying…' : 'Apply recommended policy'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
