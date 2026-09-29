import { splitQuestionText } from '@/core/decision-text';
import type { ThreadMessage, ThreadMessageOption } from '@/types/index';
import { Button, Card, Disclosure, ListItem, Stamp, Textarea } from '@dendelion/paper-ui';
import { useState } from 'react';

interface QuestionCardProps {
  message: ThreadMessage;
  onAnswer: (text: string) => Promise<boolean>;
  busy: boolean;
}

export const QuestionCard = ({ message, onAnswer, busy }: QuestionCardProps) => {
  const [chosen, setChosen] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const options = message.options ?? [];
  const { phaseLine, question } = splitQuestionText(message.text);
  const answered = message.state === 'resolved' || chosen !== null;

  const pick = async (option: ThreadMessageOption) => {
    setSending(true);
    const ok = await onAnswer(option.label);
    setSending(false);
    if (ok) setChosen(option.label);
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    const ok = await onAnswer(text);
    setSending(false);
    if (ok) {
      setChosen(text);
      setReply('');
    }
  };

  return (
    <Card size="small" surface="paper" texture="kraft" shade accent accentColor="rose">
      {phaseLine && <p className="text-sm m-0 mb-1 opacity-[0.55]">{phaseLine}</p>}
      <p className="text-base m-0 mb-2">{question}</p>
      {message.context && (
        <div className="mb-2">
          <Disclosure expanded={contextOpen} onToggle={() => setContextOpen((v) => !v)}>
            Why it matters
          </Disclosure>
          {contextOpen && <p className="text-sm m-0 mt-1 opacity-[0.7]">{message.context}</p>}
        </div>
      )}
      <div className="flex flex-col gap-2 mb-2">
        {options.map((option, i) => (
          <ListItem
            key={option.label}
            onClick={() => pick(option)}
            active={chosen === option.label}
            disabled={busy || sending || answered}
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="flex items-center gap-2">
                {option.label}
                {i === 0 && (
                  <Stamp size="small" variant="success">
                    Recommended
                  </Stamp>
                )}
              </span>
              {option.consequence && (
                <span className="text-sm opacity-[0.6]">{option.consequence}</span>
              )}
            </div>
          </ListItem>
        ))}
      </div>
      {!answered && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            aria-label="Answer in your own words"
            placeholder="Or answer in your own words…"
            rows={2}
            disabled={busy || sending}
          />
          <div className="flex justify-end">
            <Button size="small" onClick={sendReply} disabled={busy || sending || !reply.trim()}>
              Send
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
