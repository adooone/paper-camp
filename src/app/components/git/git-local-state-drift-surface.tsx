import { fixLocalStateDrift } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { Button, Stamp } from '@dendelion/folk-ui';
import { useState } from 'react';

const LOCAL_STATE_RULES = new Set([
  'local-state-tracked-outside-plan',
  'local-state-missing-local-gitignore',
  'local-state-missing-gitattributes-block',
]);

export const GitLocalStateDriftSurface = () => {
  const findings = useAppStore((s) => s.doctor.findings).filter((f) =>
    LOCAL_STATE_RULES.has(f.rule),
  );
  const loadDoctor = useAppStore((s) => s.loadDoctor);
  const [expanded, setExpanded] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (findings.length === 0) return null;

  const handleFix = async () => {
    setFixing(true);
    setError(null);
    try {
      const result = await fixLocalStateDrift();
      if (result.status === 'skipped') {
        setError(
          result.skipReason === 'rebase-in-progress'
            ? 'Mid-rebase — finish or abort it, then fix again.'
            : 'Staged changes in the way — commit or unstage them, then fix again.',
        );
      }
      await loadDoctor();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div>
      <Stamp
        size="small"
        variant="warning"
        onClick={() => setExpanded((prev) => !prev)}
        pressed={expanded}
      >
        {findings.length} local-state drift
      </Stamp>
      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          <ul className="m-0 flex flex-col gap-1 pl-4 text-2xs opacity-80">
            {findings.map((finding) => (
              <li key={`${finding.file}:${finding.rule}`}>
                {finding.file} — {finding.message}
              </li>
            ))}
          </ul>
          {error && <p className="m-0 text-2xs text-watercolor-amber-dark">{error}</p>}
          <Button size="small" variant="secondary" onClick={handleFix} disabled={fixing}>
            {fixing ? 'Fixing…' : 'Fix'}
          </Button>
        </div>
      )}
    </div>
  );
};
