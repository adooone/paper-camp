import { daemonStartCommand } from '@/app/services/hub';
import {
  type PairCodeInput,
  buildMachineLink,
  hostLabel,
  normalizePairCode,
  pairMachine,
  parsePairCode,
  readPairCodeFromHash,
  resolveMachineHost,
} from '@/app/services/machine-connection';
import { listMachines } from '@/app/services/machine-store';
import { mountPrefix } from '@/app/services/mount';
import { pairWithCode } from '@/app/services/pairing-api';
import { fetchMachineProjects } from '@/app/services/system';
import { Button, Card, CommandLine, Input } from '@dendelion/folk-ui';
import { surface } from '@dendelion/folk-ui/tokens';
import { type ReactNode, useEffect, useState } from 'react';

type Attempt =
  | { status: 'idle' }
  | { status: 'pairing' }
  | { status: 'bad-machine' }
  | { status: 'bad-code' }
  | { status: 'unreachable'; input: PairCodeInput }
  | { status: 'rejected'; host: string }
  | { status: 'outdated'; host: string }
  | { status: 'failed'; host: string; httpStatus: number | null };

const KNOWN_MACHINES_LIST = 'pc-known-machines';

const messageFor = (attempt: Attempt): ReactNode => {
  switch (attempt.status) {
    case 'bad-machine':
      return (
        <>
          Enter the machine's full address, like <code>deimos.your-tailnet.ts.net</code>. A short
          name works once this browser knows a machine on that tailnet.
        </>
      );
    case 'bad-code':
      return <>A pairing code has eight characters, like 7KQ4-M9XZ.</>;
    case 'rejected':
      return (
        <>
          {hostLabel(attempt.host)} didn't accept this code — it expired or was already used. Run{' '}
          <code>paper-camp pair</code> again.
        </>
      );
    case 'outdated':
      return (
        <>
          {hostLabel(attempt.host)} runs an older paper-camp that can't take pairing codes. Update
          it with <code>npm install -g @dendelion/paper-camp@latest</code> and restart the daemon.
        </>
      );
    case 'failed':
      // Reachable, yet no readable answer: an old daemon's 404 carries no CORS headers.
      return attempt.httpStatus ? (
        <>
          Couldn't pair with {hostLabel(attempt.host)} (error {attempt.httpStatus}). Try again in a
          moment.
        </>
      ) : (
        <>
          {hostLabel(attempt.host)} didn't answer the pairing request — it most likely runs an older
          paper-camp. Run <code>paper-camp update</code> there, restart the daemon, and try again
          with a new code.
        </>
      );
    default:
      return (
        <>
          Run <code>paper-camp pair</code> on the machine, then enter what it prints.
        </>
      );
  }
};

const isError = (attempt: Attempt) =>
  attempt.status !== 'idle' && attempt.status !== 'pairing' && attempt.status !== 'unreachable';

export const AddMachineFooter = () => {
  const [machine, setMachine] = useState('');
  const [code, setCode] = useState('');
  const [attempt, setAttempt] = useState<Attempt>({ status: 'idle' });
  const startCommand = daemonStartCommand(window.location.origin);
  const knownMachines = listMachines();

  const attemptPair = async (input: PairCodeInput) => {
    setAttempt({ status: 'pairing' });
    const outcome = await pairMachine(
      input.machineUrl,
      input.code,
      fetchMachineProjects,
      pairWithCode,
    );
    if (outcome.ok) {
      window.location.assign(
        buildMachineLink(
          outcome.machineUrl,
          outcome.pairingToken,
          window.location.origin,
          mountPrefix,
        ),
      );
      return;
    }
    if (outcome.reason === 'unreachable') setAttempt({ status: 'unreachable', input });
    else if (outcome.reason === 'failed')
      setAttempt({ status: 'failed', host: input.host, httpStatus: outcome.status });
    else setAttempt({ status: outcome.reason, host: input.host });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount to consume the fragment, not on every attemptPair identity change.
  useEffect(() => {
    const input = readPairCodeFromHash(window.location.hash);
    if (!input) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setMachine(input.host);
    setCode(input.code);
    void attemptPair(input);
  }, []);

  // Pasting what `paper-camp pair` prints as one string fills both fields.
  const takeInput = (value: string, field: 'machine' | 'code') => {
    const combined = value.includes('@') ? parsePairCode(value) : null;
    if (combined) {
      setMachine(combined.host);
      setCode(combined.code);
    } else if (field === 'machine') setMachine(value);
    else setCode(value);
    if (attempt.status !== 'idle') setAttempt({ status: 'idle' });
  };

  const submit = () => {
    const host = resolveMachineHost(machine, knownMachines);
    if (!host) {
      setAttempt({ status: 'bad-machine' });
      return;
    }
    const normalized = normalizePairCode(code);
    if (!normalized) {
      setAttempt({ status: 'bad-code' });
      return;
    }
    setMachine(host.host);
    setCode(normalized);
    void attemptPair({ code: normalized, host: host.host, machineUrl: host.machineUrl });
  };

  const pairing = attempt.status === 'pairing';
  const onEnter = (e: { key: string }) => {
    if (e.key === 'Enter') submit();
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
          <p className="m-0 text-sm opacity-70">{messageFor(attempt)}</p>
          <Input
            size="small"
            label="Machine"
            placeholder="deimos.your-tailnet.ts.net"
            list={knownMachines.length > 0 ? KNOWN_MACHINES_LIST : undefined}
            value={machine}
            error={attempt.status === 'bad-machine'}
            disabled={pairing}
            onChange={(e) => takeInput(e.target.value, 'machine')}
            onKeyDown={onEnter}
          />
          <div className="flex items-end gap-2">
            <Input
              size="small"
              label="Code"
              className="min-w-0 flex-1"
              placeholder="7KQ4-M9XZ"
              autoComplete="one-time-code"
              value={code}
              error={isError(attempt) && attempt.status !== 'bad-machine'}
              disabled={pairing}
              onChange={(e) => takeInput(e.target.value, 'code')}
              onKeyDown={onEnter}
            />
            <Button
              size="small"
              variant="secondary"
              className="shrink-0"
              onClick={submit}
              disabled={pairing}
            >
              {pairing ? 'Pairing…' : 'Add'}
            </Button>
          </div>
          {knownMachines.length > 0 && (
            <datalist id={KNOWN_MACHINES_LIST}>
              {knownMachines.map((url) => (
                <option key={url} value={url.replace(/^https?:\/\//, '')} />
              ))}
            </datalist>
          )}
        </>
      )}
    </Card>
  );
};
