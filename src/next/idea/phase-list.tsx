import type { EntityDetailEntry, TaskKind } from '@/types/index';
import { taskDoing } from '../shell/idea-model';
import { Hand } from '../ui/hand';
import { ListLabel } from '../ui/list';
import { Stamp } from '../ui/stamp';
import styles from './idea.module.css';

interface PhaseListProps {
  idea: EntityDetailEntry;
  activeIndex: number | null;
  tail: string[];
  liveKind: TaskKind | null;
}

const Tail = ({ lines }: { lines: string[] }) => (
  <Hand size="xs" color="inkFaint" className={styles.tail}>
    {lines.join('\n')}
  </Hand>
);

function LiveTaskRow({ kind, tail }: { kind: TaskKind; tail: string[] }) {
  return (
    <div className={styles.phaseRow}>
      <div className={styles.phaseMain}>
        <Hand size="base" bold>
          {`${taskDoing(kind)}…`}
        </Hand>
        {tail.length > 0 ? (
          <Tail lines={tail} />
        ) : (
          <Hand size="xs" color="inkFaint">
            Waiting for the agent's first output.
          </Hand>
        )}
      </div>
      <Stamp meaning="running">running</Stamp>
    </div>
  );
}

function PhaseRow({
  index,
  text,
  done,
  active,
  tail,
}: {
  index: number;
  text: string;
  done: boolean;
  active: boolean;
  tail: string[];
}) {
  return (
    <div className={styles.phaseRow}>
      <span
        className={done ? `${styles.phaseBox} ${styles.phaseBoxDone}` : styles.phaseBox}
        aria-hidden="true"
      >
        {done ? (
          <Hand size="sm" bold color="canvas700">
            ✓
          </Hand>
        ) : null}
      </span>
      <div className={styles.phaseMain}>
        <Hand size="base" bold={active} color={done ? 'inkSoft' : 'ink'}>
          {`${index + 1}. ${text}`}
        </Hand>
        {active && tail.length > 0 ? <Tail lines={tail} /> : null}
      </div>
      {active ? <Stamp meaning="running">running</Stamp> : null}
    </div>
  );
}

export function PhaseList({ idea, activeIndex, tail, liveKind }: PhaseListProps) {
  return (
    <div className={styles.section}>
      <ListLabel>Phases</ListLabel>
      {liveKind ? <LiveTaskRow kind={liveKind} tail={tail} /> : null}
      {idea.phases.length === 0 && !liveKind ? (
        <Hand size="sm" color="inkSoft">
          No phases yet.
        </Hand>
      ) : null}
      {idea.phases.map((phase, index) => (
        <PhaseRow
          key={phase.text}
          index={index}
          text={phase.text}
          done={phase.done}
          active={index === activeIndex}
          tail={tail}
        />
      ))}
    </div>
  );
}
