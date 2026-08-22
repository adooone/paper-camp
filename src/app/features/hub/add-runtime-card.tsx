import { runtimeAdditionUrl } from '@/app/services/hub';
import { Button, Card, Input } from '@dendelion/paper-ui';
import { useState } from 'react';

export const AddByRuntimeUrlCard = () => {
  const [runtimeUrl, setRuntimeUrl] = useState('');
  const trimmedUrl = runtimeUrl.trim();

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Add a project by URL</p>
      <p className="m-0 text-sm opacity-70">
        Paste the address <code>paper-camp dev</code> printed when it started.
      </p>
      <Input
        size="small"
        label="Runtime URL"
        placeholder="http://localhost:3333"
        value={runtimeUrl}
        onChange={(e) => setRuntimeUrl(e.target.value)}
      />
      <Button
        size="small"
        disabled={trimmedUrl === ''}
        onClick={() =>
          window.location.assign(runtimeAdditionUrl(window.location.pathname, trimmedUrl))
        }
      >
        Connect
      </Button>
    </Card>
  );
};
