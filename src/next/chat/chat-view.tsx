import type { ChatScreenState } from '../hooks/use-chat-screen';
import { useStickToBottom } from '../hooks/use-stick-to-bottom';
import { emptyLine } from '../shell/chat-model';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { SkeletonRows } from '../ui/skeleton-rows';
import styles from './chat.module.css';
import { Composer } from './composer';
import { MessageBubble } from './message-bubble';
import { PermissionCard } from './permission-card';
import { QuestionCard } from './question-card';
import { TurnView } from './turn-view';

interface ChatViewProps {
  screen: ChatScreenState;
}

function Thread({ screen }: ChatViewProps) {
  if (screen.load === 'loading') return <SkeletonRows />;
  if (screen.load === 'unreachable') {
    return (
      <div className={styles.empty}>
        <Hand size="lg" color="inkSoft">
          Couldn't reach {screen.projectName ?? 'this project'}.
        </Hand>
        <Button label="Try again" variant="secondary" onPress={screen.reload} />
      </div>
    );
  }
  if (screen.items.length === 0 && screen.outbox.length === 0) {
    return <EmptyState title="No messages yet" line={emptyLine(screen.projectName)} />;
  }
  return (
    <>
      {screen.items.map(({ id, message }) =>
        message.kind === 'question' ? (
          <QuestionCard key={id} message={message} onOpenIdea={screen.openIdea} />
        ) : (
          <MessageBubble
            key={id}
            message={message}
            delivery={id === screen.newestUserId ? (screen.delivery ?? undefined) : undefined}
            onRetry={screen.retryTurn}
          />
        ),
      )}
      {screen.outbox.map((entry) => (
        <MessageBubble
          key={entry.id}
          message={{ kind: 'chat', from: 'user', text: entry.text, date: entry.date }}
          delivery={entry.status}
          detail={entry.error}
          onRetry={() => screen.retryOutbox(entry)}
        />
      ))}
      {screen.turn && (screen.turn.live || screen.turn.text) ? (
        <TurnView turn={screen.turn} />
      ) : null}
      {screen.permission ? (
        <PermissionCard
          ask={screen.permission}
          disabled={screen.sending}
          onChoose={screen.choose}
        />
      ) : null}
    </>
  );
}

export function ChatView({ screen }: ChatViewProps) {
  useStickToBottom(
    `${screen.items.length}:${screen.outbox.length}:${screen.turn?.text.length ?? 0}:${screen.turn?.tools.length ?? 0}:${screen.turn?.stage ?? ''}`,
  );
  const walking = screen.walk !== null;
  const topSlot =
    walking || screen.walkMessage ? (
      <>
        {walking ? (
          <div className={styles.walkRow}>
            <Hand size="sm" font="hand" color="inkSoft">
              Running {(screen.walk?.index ?? 0) + 1} of {screen.walkTotal}…
            </Hand>
            <Button label="Stop" variant="secondary" size="sm" onPress={screen.stopWalk} />
          </div>
        ) : null}
        {screen.walkMessage ? (
          <Hand size="sm" color="danger">
            {screen.walkMessage}
          </Hand>
        ) : null}
      </>
    ) : null;
  return (
    <section className={styles.chat} aria-label="Chat">
      <div className={styles.thread}>
        <Thread screen={screen} />
        {screen.error ? (
          <Hand size="sm" color="danger" className={styles.status}>
            {screen.error}
          </Hand>
        ) : null}
        {screen.notice ? (
          <Hand size="sm" font="hand" color="inkSoft" className={styles.status}>
            {screen.notice}
          </Hand>
        ) : null}
      </div>
      <Composer
        topSlot={topSlot}
        value={screen.draft}
        onChange={screen.setDraft}
        onSubmit={screen.send}
        busy={screen.sending}
        placeholder={screen.placeholder}
      />
    </section>
  );
}
