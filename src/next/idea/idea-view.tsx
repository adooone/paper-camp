import type { IdeaScreenState } from '../hooks/use-idea-screen';
import { ideaStatusMeaning } from '../shell/idea-model';
import { STATUS_LABEL, statusOf } from '../shell/ideas-model';
import { Hand } from '../ui/hand';
import { ListLabel } from '../ui/list';
import { Stamp } from '../ui/stamp';
import { ActionBar } from './action-bar';
import { BodyCard } from './body-card';
import { HeadCard } from './head-card';
import styles from './idea.module.css';
import { PhaseList } from './phase-list';
import { StatusSection } from './status-section';
import { ThreadSection } from './thread-section';

interface IdeaViewProps {
  screen: IdeaScreenState;
  onBack?: () => void;
  onDiscuss: () => void;
}

export function IdeaView({ screen, onBack, onDiscuss }: IdeaViewProps) {
  const { idea } = screen;
  if (!idea) return null;
  const status = statusOf(idea);
  return (
    <article className={styles.column}>
      {onBack ? (
        <div className={styles.header}>
          <button type="button" onClick={onBack} className={styles.back}>
            <Hand size="base" bold color="inkSoft">
              ← Back
            </Hand>
          </button>
          <Stamp meaning={ideaStatusMeaning(status)}>{STATUS_LABEL[status]}</Stamp>
        </div>
      ) : null}
      <HeadCard idea={idea} status={status} activeIndex={screen.activeIndex} />
      {screen.error ? (
        <Hand size="sm" color="danger">
          {screen.error}
        </Hand>
      ) : null}
      {screen.placeholder ? null : (
        <PhaseList
          idea={idea}
          activeIndex={screen.activeIndex}
          tail={screen.tail}
          liveKind={screen.liveKind}
        />
      )}
      <div className={styles.section}>
        <ListLabel>Description</ListLabel>
        <BodyCard body={idea.body} />
      </div>
      <StatusSection
        status={status}
        busy={screen.transitionBusy}
        disabled={screen.locked}
        onSelect={screen.transition}
      />
      <ThreadSection messages={idea.thread ?? []} onDiscuss={onDiscuss} />
      <ActionBar
        phaseCount={idea.phases.length}
        phasesDone={idea.phases.every((phase) => phase.done)}
        placeholder={screen.placeholder}
        running={screen.tasks.running}
        walk={screen.walk}
        busy={screen.busy}
        onDraft={screen.draft}
        onRunNext={screen.runNext}
        onRunAll={screen.runAll}
        onStop={screen.stop}
      />
    </article>
  );
}
