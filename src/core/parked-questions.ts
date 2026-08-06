import type { EntityEntry, ParkedQuestion } from '../types/index';
import { readEntities } from './readers';

function ageInDays(date: string): number {
  return Math.floor((Date.now() - Date.parse(date)) / 86_400_000);
}

const isOpenQuestion = (kind: string, state: string | undefined): boolean =>
  kind === 'question' && (state ?? 'open') === 'open';

/** Every open `question` thread message across the given entities, oldest-first —
 * the pull-based inbox of parked agent decisions (IDEA-118). */
export function collectParkedQuestions(entities: EntityEntry[]): ParkedQuestion[] {
  return entities
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
