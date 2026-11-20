import type { KeyboardEvent, ReactNode } from 'react';
import { isSendKey } from '@/app/features/chat/helpers';
import { Button } from '../ui/button';
import styles from './chat.module.css';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  placeholder: string;
  topSlot?: ReactNode;
}

export function Composer({ value, onChange, onSubmit, busy, placeholder, topSlot }: ComposerProps) {
  const canSend = value.trim().length > 0 && !busy;
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isSendKey(event)) return;
    event.preventDefault();
    if (canSend) onSubmit();
  };
  return (
    <div className={styles.composer}>
      {topSlot}
      {/* folk-ui's Textarea is a sketched field; the phone's composer is a bare growing input. */}
      <textarea
        aria-label="Chat composer"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        disabled={busy}
        className={styles.input}
      />
      <div className={styles.controls}>
        <Button
          label={busy ? 'Sending…' : 'Send'}
          size="sm"
          onPress={onSubmit}
          disabled={!canSend}
        />
      </div>
    </div>
  );
}
