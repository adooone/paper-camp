import type { ThreadMessage } from '@/types/index';
import { Hand } from '../ui/hand';
import { KraftCard } from '../ui/kraft-card';
import { Stamp } from '../ui/stamp';
import styles from './chat.module.css';

interface QuestionCardProps {
  message: ThreadMessage;
  onOpenIdea: (ideaId: string) => void;
}

export function QuestionCard({ message, onOpenIdea }: QuestionCardProps) {
  return (
    <div className={styles.questionWrap}>
      <KraftCard className={styles.questionCard}>
        <div className={styles.questionBody}>
          <div className={styles.questionHead}>
            <Hand size="md" bold>
              Scout has a question
            </Hand>
            <Stamp meaning="parked">{message.state === 'resolved' ? 'resolved' : 'parked'}</Stamp>
          </div>
          <Hand size="base" className={styles.prose}>
            {message.text}
          </Hand>
          {message.options?.map((option) => (
            <Hand key={option.label} size="sm" color="inkSoft">
              • {option.label} — {option.consequence}
            </Hand>
          ))}
          {message.entityId ? (
            <button
              type="button"
              aria-label={`Answer about ${message.entityId}`}
              onClick={() => onOpenIdea(message.entityId ?? '')}
              className={styles.ideaLink}
            >
              <Hand size="sm" color="inkSoft">
                {message.entityId}
              </Hand>
            </button>
          ) : null}
        </div>
      </KraftCard>
    </div>
  );
}
