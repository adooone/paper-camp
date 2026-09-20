import type { EntityEntry, ParkedQuestion, ThreadMessage } from '../types/index';
import { readEntities } from './readers';

function ageInDays(date: string): number {
  return Math.floor((Date.now() - Date.parse(date)) / 86_400_000);
}

const isOpenQuestion = (kind: string, state: string | undefined): boolean =>
  kind === 'question' && (state ?? 'open') === 'open';

// A question parked on an idea that has since closed was settled by the closing itself.
export const isClosedEntity = (entity: Pick<EntityEntry, 'status' | 'archived'>): boolean =>
  Boolean(entity.archived) || entity.status === 'done' || entity.status === 'dropped';

/** Every open `question` thread message across the given entities, oldest-first —
 * the pull-based inbox of parked agent decisions (IDEA-118). */
export function collectParkedQuestions(entities: EntityEntry[]): ParkedQuestion[] {
  return entities
    .filter((entity) => !isClosedEntity(entity))
    .flatMap((entity) =>
      (entity.thread ?? [])
        .filter((m) => isOpenQuestion(m.kind, m.state))
        .map((m) => ({
          entityId: entity.id,
          entityTitle: entity.title,
          text: m.text,
          date: m.date,
          ageDays: m.date ? ageInDays(m.date) : Number.POSITIVE_INFINITY,
        })),
    )
    .sort((a, b) => b.ageDays - a.ageDays);
}

export async function readParkedQuestions(ideasDir: string): Promise<ParkedQuestion[]> {
  const { entries } = await readEntities(ideasDir);
  return collectParkedQuestions(entries);
}

/** Chat mirrors a parked question with its idea as a `[[ID]]` prefix, parsed into
 * `entityId`; once that idea closes, the mirror reads as resolved rather than
 * counting as unanswered forever. */
export function resolveClosedIdeaQuestions(
  thread: ThreadMessage[],
  entities: EntityEntry[],
): ThreadMessage[] {
  const closed = new Set(entities.filter(isClosedEntity).map((entity) => entity.id));
  return thread.map((message) => {
    if (!isOpenQuestion(message.kind, message.state)) return message;
    return message.entityId && closed.has(message.entityId)
      ? { ...message, state: 'resolved' as const }
      : message;
  });
}
