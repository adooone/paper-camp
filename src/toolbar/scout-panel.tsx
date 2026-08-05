import { PlanIdStamp } from '@/app/features/plans/components';
import type { OpenQuestionGroup } from '@/app/features/plans/helpers';
import { useSendFeedbackMessage } from '@/app/features/plans/hooks';
import type { PlanEntry } from '@/types/index';
import { Button, Spinner, Stamp, Textarea } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { ToolbarLink } from './toolbar-link';

const titleStyle: CSSProperties = { fontWeight: 600, marginBottom: '0.5rem' };
const ideaRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  marginBottom: '0.375rem',
};
const questionTextStyle: CSSProperties = { marginBottom: '0.5rem' };
const mutedStyle: CSSProperties = { opacity: 0.6, fontSize: '0.75rem' };
const errorRowStyle: CSSProperties = { marginTop: '0.375rem' };
const footerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '0.5rem',
  gap: '0.5rem',
};

const noopReload = async () => {};

const ReplyBox = ({
  plan,
  placeholder,
  onSent,
}: {
  plan: PlanEntry;
  placeholder: string;
  onSent: () => void;
}) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  // No <ToastProvider> inside the toolbar's shadow DOM (its portal would render
  // unstyled in the host page), so failures surface inline here instead.
  const { sending, send } = useSendFeedbackMessage(plan, {
    reload: noopReload,
    notify: (options) => setError(options.title ?? 'Something went wrong'),
  });

  const handleSend = async () => {
    setError(null);
    if (!input.trim()) return;
    if (await send(input.trim())) {
      setInput('');
      onSent();
    }
  };

  return (
    <div>
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label={`Reply to ${plan.title}`}
        placeholder={placeholder}
        rows={2}
        disabled={sending}
      />
      <div style={footerRowStyle}>
        {sending ? <Spinner size="small" label="Scout replying…" /> : <span />}
        <Button size="small" onClick={handleSend} disabled={sending || !input.trim()}>
          Send
        </Button>
      </div>
      {error && (
        <div style={errorRowStyle}>
          <Stamp size="small" variant="error">
            {error}
          </Stamp>
        </div>
      )}
    </div>
  );
};

export interface ScoutPanelProps {
  focusPlan: PlanEntry | null;
  openQuestions: OpenQuestionGroup[];
  onOpenIdea: (plan: PlanEntry) => void;
  onRefresh: () => void;
}

// Toolbar-safe Scout mount (IDEA-130 phase 6): the oldest project-wide open
// question surfaces first — replying resumes its parked run — falling back to a
// plain chat/capture box on the focused idea once the inbox is empty. Full
// history and promote-to-decision/idea/log stay desk-only (deep work).
export const ScoutPanel = ({
  focusPlan,
  openQuestions,
  onOpenIdea,
  onRefresh,
}: ScoutPanelProps) => {
  const [oldest] = openQuestions;

  if (oldest) {
    const question = oldest.questions[0];
    const remainingQuestionCount =
      openQuestions.reduce((sum, group) => sum + group.questions.length, 0) - 1;
    return (
      <div>
        <div style={titleStyle}>Scout</div>
        <div style={ideaRowStyle}>
          <PlanIdStamp id={oldest.plan.id} />
          <span>{oldest.plan.title}</span>
        </div>
        <p style={questionTextStyle}>{question.text}</p>
        <ReplyBox
          plan={oldest.plan}
          placeholder="Reply to resolve and resume…"
          onSent={onRefresh}
        />
        <div style={footerRowStyle}>
          {remainingQuestionCount > 0 ? (
            <span style={mutedStyle}>{remainingQuestionCount} more open question(s)</span>
          ) : (
            <span />
          )}
          <ToolbarLink onClick={() => onOpenIdea(oldest.plan)}>Open idea →</ToolbarLink>
        </div>
      </div>
    );
  }

  if (focusPlan) {
    return (
      <div>
        <div style={titleStyle}>Scout</div>
        <ReplyBox
          plan={focusPlan}
          placeholder="Ask Scout, jot a note, or say “note this down as an idea”…"
          onSent={onRefresh}
        />
        <div style={footerRowStyle}>
          <span />
          <ToolbarLink onClick={() => onOpenIdea(focusPlan)}>Open idea →</ToolbarLink>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={titleStyle}>Scout</div>
      <span style={mutedStyle}>No active idea and no open questions.</span>
    </div>
  );
};
