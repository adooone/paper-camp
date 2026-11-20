import type { ThreadMessage } from '@/types/index';
import { bubbleStamp, DELIVERY_LABEL, type DeliveryStatus, messageTime } from '../shell/chat-model';
import { Hand } from '../ui/hand';
import { Stamp } from '../ui/stamp';
import styles from './chat.module.css';

interface MessageBubbleProps {
  message: ThreadMessage;
  delivery?: DeliveryStatus;
  detail?: string;
  onRetry?: () => void;
}

export function MessageBubble({ message, delivery, detail, onRetry }: MessageBubbleProps) {
  const fromYou = message.from !== 'agent';
  const stamp = bubbleStamp(message);
  const failed = delivery === 'failed';
  const note = delivery ? (
    <Hand size="xs" color={failed ? 'danger' : 'inkSoft'} font="hand" className={styles.delivery}>
      {DELIVERY_LABEL[delivery]}
    </Hand>
  ) : null;
  return (
    <div className={`${styles.bubbleRow} ${fromYou ? styles.rowYou : styles.rowAgent}`}>
      <div className={`${styles.bubble} ${fromYou ? styles.bubbleYou : styles.bubbleAgent}`}>
        <div className={styles.meta}>
          <Stamp meaning={stamp.meaning}>{stamp.label}</Stamp>
          <Hand size="xs" color="inkSoft" font="hand">
            {messageTime(message.date)}
          </Hand>
        </div>
        <Hand size="base" className={styles.prose}>
          {message.text}
        </Hand>
      </div>
      {fromYou && note ? (
        failed ? (
          <button type="button" onClick={onRetry} className={styles.retryButton}>
            {note}
            {detail ? (
              <Hand size="sm" color="danger" className={styles.delivery}>
                {detail}
              </Hand>
            ) : null}
          </button>
        ) : (
          note
        )
      ) : null}
    </div>
  );
}
