import { Button, Card, Textarea } from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';

export interface ActivityComposerProps {
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  onSend: () => void;
}

export const ActivityComposer = ({ input, setInput, sending, onSend }: ActivityComposerProps) => (
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
        <Button size="small" onClick={onSend} disabled={sending || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  </Card>
);
