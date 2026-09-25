import { daemonStartCommand } from '@/app/services/hub';
import { rehostPairingLink } from '@/app/services/machine-connection';
import { mountPrefix } from '@/app/services/mount';
import { Button, Card, CommandLine, Input } from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';
import { useState } from 'react';

export const AddMachineFooter = () => {
  const [link, setLink] = useState('');
  const [error, setError] = useState(false);
  const startCommand = daemonStartCommand(window.location.origin);

  const submit = () => {
    const trimmed = link.trim();
    if (trimmed === '') return;
    const target = rehostPairingLink(trimmed, window.location.origin, mountPrefix);
    if (!target) {
      setError(true);
      return;
    }
    window.location.assign(target);
  };

  return (
    <Card size="small" texture={surface.card} className="flex flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Add a machine</p>
      <CommandLine command={startCommand} />
      <p className="m-0 text-sm opacity-70">Then open the link it prints, or paste it here.</p>
      <div className="flex items-start gap-2">
        <Input
          size="small"
          className="min-w-0 flex-1"
          placeholder="Paste a link"
          value={link}
          error={error}
          onChange={(e) => {
            setLink(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <Button size="small" variant="secondary" onClick={submit}>
          Add
        </Button>
      </div>
    </Card>
  );
};
