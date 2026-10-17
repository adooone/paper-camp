import type { ScopeRow } from '@/app/features/scope';
import { Button, Card, Select, Textarea } from '@dendelion/folk-ui';
import { surface } from '@dendelion/folk-ui/tokens';
import type { KeyboardEvent, Ref } from 'react';
import { isSendKey } from '../helpers';

export interface ChatComposerProps {
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  onSend: () => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
  projectOptions?: ScopeRow[];
  targetProjectKey?: string;
  onTargetProjectChange?: (key: string) => void;
}

export const ChatComposer = ({
  input,
  setInput,
  sending,
  onSend,
  textareaRef,
  projectOptions,
  targetProjectKey,
  onTargetProjectChange,
}: ChatComposerProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isSendKey(e)) return;
    e.preventDefault();
    if (!sending && input.trim()) onSend();
  };

  return (
    <Card size="small" accent accentColor="slate" texture={surface.card} className="mb-4">
      <div className="flex flex-col gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
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
                options={projectOptions.map((row) => ({
                  value: row.key,
                  label: `in ${row.name}`,
                }))}
              />
            )}
          <Button size="small" onClick={onSend} disabled={sending || !input.trim()}>
            Send
          </Button>
        </div>
      </div>
    </Card>
  );
};
