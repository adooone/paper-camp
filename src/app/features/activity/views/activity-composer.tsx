import type { ScopeRow } from '@/app/features/scope';
import { Button, Card, Select, Textarea } from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';

export interface ActivityComposerProps {
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  onSend: () => void;
  projectOptions?: ScopeRow[];
  targetProjectKey?: string;
  onTargetProjectChange?: (key: string) => void;
}

export const ActivityComposer = ({
  input,
  setInput,
  sending,
  onSend,
  projectOptions,
  targetProjectKey,
  onTargetProjectChange,
}: ActivityComposerProps) => (
  <Card size="small" accent accentColor="slate" texture={surface.card} className="mb-4">
    <div className="flex flex-col gap-2">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label="Chat message"
        placeholder="Write a message…"
        rows={3}
      />
      <div className="flex justify-end items-center gap-3">
        {projectOptions &&
          projectOptions.length > 1 &&
          targetProjectKey &&
          onTargetProjectChange && (
            <Select
              size="small"
              aria-label="Send to"
              value={targetProjectKey}
              onChange={onTargetProjectChange}
              options={projectOptions.map((row) => ({ value: row.key, label: `in ${row.name}` }))}
            />
          )}
        <Button size="small" onClick={onSend} disabled={sending || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  </Card>
);
