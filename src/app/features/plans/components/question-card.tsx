import type { ThreadMessage, ThreadMessageOption } from '@/types/index';
import { Button, Card, Disclosure, ListItem, Stamp, Textarea } from '@dendelion/paper-ui';
import { useState } from 'react';

const DECISION_MARKER = 'needs a decision: ';

/** `escalateToLog` composes the thread message's `text` as a phase-context lead-in
 * followed by the bare question (agent.ts); split it back apart here so the card
 * can show the lead-in muted and the question at body size. */
function splitQuestionText(text: string): { phaseLine?: string; question: string } {
  const idx = text.lastIndexOf(DECISION_MARKER);
  if (idx === -1) return { question: text };
  const phaseLine = text
    .slice(0, idx)
    .replace(/[—-]\s*$/, '')
    .trim();
  return {
    phaseLine: phaseLine || undefined,
    question: text.slice(idx + DECISION_MARKER.length).trim(),
  };
}

interface QuestionCardProps {
  message: ThreadMessage;
  onAnswer: (text: string) => void;
  busy: boolean;
}

export const QuestionCard = ({ message, onAnswer, busy }: QuestionCardProps) => {
  const [chosen, setChosen] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const options = message.options ?? [];
  const { phaseLine, question } = splitQuestionText(message.text);
  const answered = message.state === 'resolved' || chosen !== null;

  const pick = (option: ThreadMessageOption) => {
    setChosen(option.label);
    onAnswer(option.label);
  };

  const sendReply = () => {
    const text = reply.trim();
    if (!text) return;
    setChosen(text);
    setReply('');
    onAnswer(text);
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
            disabled={busy || answered}
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
            disabled={busy}
          />
          <div className="flex justify-end">
            <Button size="small" onClick={sendReply} disabled={busy || !reply.trim()}>
              Send
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
