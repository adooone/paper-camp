import { daemonStartCommand } from '@/app/services/hub';
import {
  type PairCodeInput,
  buildMachineLink,
  hostLabel,
  pairMachine,
  parsePairCode,
  readPairCodeFromHash,
} from '@/app/services/machine-connection';
import { mountPrefix } from '@/app/services/mount';
import { pairWithCode } from '@/app/services/pairing-api';
import { fetchMachineProjects } from '@/app/services/system';
import { Button, Card, CommandLine, Input } from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';
import { useEffect, useState } from 'react';

type Attempt =
  | { status: 'idle' }
  | { status: 'pairing' }
  | { status: 'unreachable'; input: PairCodeInput }
  | { status: 'rejected' }
  | { status: 'invalid' };

export const AddMachineFooter = () => {
  const [code, setCode] = useState('');
  const [attempt, setAttempt] = useState<Attempt>({ status: 'idle' });
  const startCommand = daemonStartCommand(window.location.origin);

  const attemptPair = async (input: PairCodeInput) => {
    setAttempt({ status: 'pairing' });
    const outcome = await pairMachine(
      input.machineUrl,
      input.code,
      fetchMachineProjects,
      pairWithCode,
    );
    if (!outcome.ok) {
      setAttempt(
        outcome.reason === 'unreachable'
          ? { status: 'unreachable', input }
          : { status: 'rejected' },
      );
      return;
    }
    window.location.assign(
      buildMachineLink(
        outcome.machineUrl,
        outcome.pairingToken,
        window.location.origin,
        mountPrefix,
      ),
    );
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount to consume the fragment, not on every attemptPair identity change.
  useEffect(() => {
    const input = readPairCodeFromHash(window.location.hash);
    if (!input) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setCode(`${input.code}@${input.host}`);
    void attemptPair(input);
  }, []);

  const submit = () => {
    const trimmed = code.trim();
    if (trimmed === '') return;
    const input = parsePairCode(trimmed);
    if (!input) {
      setAttempt({ status: 'invalid' });
      return;
    }
    void attemptPair(input);
  };

  return (
    <Card size="small" texture={surface.card} className="flex flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Add a machine</p>
      <CommandLine command={startCommand} />
      {attempt.status === 'unreachable' ? (
        <>
          <p className="m-0 text-sm opacity-70">
            Can't reach {hostLabel(attempt.input.host)} — this address works only on your tailnet.
            Open Tailscale on this device and try again.
          </p>
          <Button size="small" variant="secondary" onClick={() => void attemptPair(attempt.input)}>
            Try again
          </Button>
        </>
      ) : (
        <>
          <p className="m-0 text-sm opacity-70">
            Run <code>paper-camp pair</code> on the machine, then paste the code it prints.
          </p>
          <div className="flex items-start gap-2">
            <Input
              size="small"
              className="min-w-0 flex-1"
              placeholder="Paste a pairing code"
              value={code}
              error={attempt.status === 'rejected' || attempt.status === 'invalid'}
              disabled={attempt.status === 'pairing'}
              onChange={(e) => {
                setCode(e.target.value);
                if (attempt.status !== 'idle') setAttempt({ status: 'idle' });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
            <Button
              size="small"
              variant="secondary"
              onClick={submit}
              disabled={attempt.status === 'pairing'}
            >
              Add
            </Button>
          </div>
          {attempt.status === 'rejected' && (
            <p className="m-0 text-sm opacity-70">
              This code expired or was already used — run <code>paper-camp pair</code> again.
            </p>
          )}
        </>
      )}
    </Card>
  );
};
