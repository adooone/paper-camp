import { Button, Card, InlineCode } from '@dendelion/folk-ui';
import { useState } from 'react';
import type { ChatPermissionAsk, ChatPermissionChoice } from '@/types/index';

const TOOL_VERBS: Record<string, string> = {
  bash: 'Run',
  read: 'Read',
  edit: 'Edit',
  multiedit: 'Edit',
  notebookedit: 'Edit',
  write: 'Write',
  webfetch: 'Fetch',
  websearch: 'Search the web for',
};

export function permissionQuestion({ tool, target }: ChatPermissionAsk): {
  verb: string;
  target?: string;
} {
  const verb = TOOL_VERBS[tool.toLowerCase()];
  if (verb && target) return { verb, target };
  return target ? { verb: `Use ${tool} on`, target } : { verb: `Use ${tool}` };
}

const CHOICES: { choice: ChatPermissionChoice; label: string }[] = [
  { choice: 'once', label: 'Allow once' },
  { choice: 'always', label: 'Always allow' },
  { choice: 'skip', label: 'Skip' },
];

interface ChatPermissionCardProps {
  ask: ChatPermissionAsk;
  disabled?: boolean;
  onChoose: (choice: ChatPermissionChoice, ask: ChatPermissionAsk) => Promise<void>;
}

export const ChatPermissionCard = ({
  ask,
  disabled = false,
  onChoose,
}: ChatPermissionCardProps) => {
  const [choosing, setChoosing] = useState<ChatPermissionChoice | null>(null);
  const { verb, target } = permissionQuestion(ask);

  const choose = async (choice: ChatPermissionChoice) => {
    setChoosing(choice);
    try {
      await onChoose(choice, ask);
    } finally {
      setChoosing(null);
    }
  };

  return (
    <div className="flex flex-col gap-1 items-start mb-3 pl-8">
      <div className="max-w-[85%] min-w-0">
        <Card size="small" surface="paper" texture="kraft" shade accent accentColor="rose">
          <p className="text-base m-0 mb-2 break-words">
            {verb}
            {target && (
              <>
                {' '}
                <InlineCode>{target}</InlineCode>
              </>
            )}
            ?
          </p>
          <div className="flex flex-wrap gap-2">
            {CHOICES.map(({ choice, label }) => (
              <Button
                key={choice}
                size="small"
                variant={choice === 'once' ? 'primary' : choice === 'skip' ? 'ghost' : 'secondary'}
                onClick={() => choose(choice)}
                disabled={disabled || choosing !== null}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
