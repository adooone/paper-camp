import type { ChatTurnInfo } from '@/app/features/chat/hooks/use-chat-stage';
import { STAGE_LABEL, TAIL_LINES } from '../shell/chat-model';
import { Hand } from '../ui/hand';
import styles from './chat.module.css';

export function TurnView({ turn }: { turn: ChatTurnInfo }) {
  const tools = turn.tools.slice(-TAIL_LINES);
  const offset = turn.tools.length - tools.length;
  return (
    <div className={styles.working}>
      {turn.stage ? (
        <Hand size="sm" font="hand" color="inkSoft">
          {STAGE_LABEL[turn.stage]}
        </Hand>
      ) : null}
      {tools.map((tool, index) => (
        <Hand
          key={`${offset + index}`}
          size="xs"
          font="hand"
          color="inkFaint"
          className={styles.tool}
        >
          {tool}
        </Hand>
      ))}
      {turn.text ? (
        <Hand size="base" className={styles.prose}>
          {turn.text}
        </Hand>
      ) : null}
    </div>
  );
}
