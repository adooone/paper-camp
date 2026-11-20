import type { ThreadMessage } from '@/types/index';
import { threadStampLine } from '../shell/idea-model';
import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { ListLabel } from '../ui/list';
import styles from './idea.module.css';

interface ThreadSectionProps {
  messages: ThreadMessage[];
  onDiscuss: () => void;
}

export function ThreadSection({ messages, onDiscuss }: ThreadSectionProps) {
  return (
    <div className={styles.section}>
      <ListLabel>Thread</ListLabel>
      {messages.length === 0 ? (
        <Hand size="sm" color="inkSoft">
          Nothing in the thread yet.
        </Hand>
      ) : (
        messages.map((message) => (
          <div key={`${message.date ?? 'undated'}:${message.text}`} className={styles.threadRow}>
            <Hand size="xs" color="inkFaint">
              {threadStampLine(message)}
            </Hand>
            <Hand size="sm" className={styles.prose}>
              {message.text}
            </Hand>
          </div>
        ))
      )}
      <Button
        label="Discuss in chat"
        variant="secondary"
        size="sm"
        onPress={onDiscuss}
        className={styles.discuss}
      />
    </div>
  );
}
