import type { ConnectionResult } from '@/types/index';
import { Button, CodeBlock } from '@dendelion/paper-ui';

interface ConnectActionViewProps {
  connection: ConnectionResult;
  onConnect: (id: string) => void;
  connecting: boolean;
}

export const ConnectActionView = ({
  connection,
  onConnect,
  connecting,
}: ConnectActionViewProps) => {
  const { connect } = connection;
  if (!connect) return null;
  if (connect.kind === 'command' && connect.runnable) {
    return (
      <Button size="small" onClick={() => onConnect(connection.id)} disabled={connecting}>
        {connecting ? 'Running…' : `Run \`${connect.command}\``}
      </Button>
    );
  }
  if (connect.kind === 'command') {
    return (
      <div className="mt-2">
        <CodeBlock code={connect.command} />
      </div>
    );
  }
  if (connect.kind === 'link') {
    return (
      <Button
        size="small"
        onClick={() => window.open(connect.url, '_blank', 'noopener,noreferrer')}
      >
        {connect.label}
      </Button>
    );
  }
  return <p className="opacity-[0.65] text-sm mt-2 mx-0 mb-0">{connect.message}</p>;
};
