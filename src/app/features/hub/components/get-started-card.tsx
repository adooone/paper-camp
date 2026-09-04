import { daemonStartCommand } from '@/app/services/hub';
import { Card, CodeBlock } from '@dendelion/paper-ui';

const COMMANDS = ['npm install --save-dev @dendelion/paper-camp', 'npx paper-camp init'] as const;

export const GetStartedCard = () => {
  const commands = [...COMMANDS, daemonStartCommand(window.location.origin)];

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Get started</p>
      {commands.map((command) => (
        <CodeBlock key={command} code={command} />
      ))}
      <p className="m-0 text-sm opacity-70">
        Then open the link the daemon prints in your terminal.
      </p>
    </Card>
  );
};
