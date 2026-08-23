import { join } from 'node:path';
import type { EntityType, ReleaseNoteIdea, ReleaseNoteSection } from '../types/index';
import { readEntities } from './readers';
import { readFileMaybe, resolveIdeasForRelease, resolveReleaseRanges } from './trail';

const TYPE_SECTION_LABELS: Record<EntityType, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  refactor: 'Code Refactoring',
  docs: 'Documentation',
  chore: 'Miscellaneous',
};

const SECTION_ORDER = Array.from(new Set(Object.values(TYPE_SECTION_LABELS)));

/** One row per idea rather than per commit: dedupes a fix-up commit into the idea's
 * initial row and swaps in the idea's title, so a release reads as shipped ideas, not raw commits. */
export async function resolveReleaseNotes(
  root: string,
  version: string,
): Promise<ReleaseNoteSection[] | null> {
  const changelog = await readFileMaybe(join(root, 'CHANGELOG.md'));
  const release = resolveReleaseRanges(changelog).find((r) => r.version === version);
  if (!release) return null;

  const [{ entries }, ideaCommits] = await Promise.all([
    readEntities(join(root, 'papercamp', 'ideas')),
    resolveIdeasForRelease(root, release.range),
  ]);

  const bySection = new Map<string, ReleaseNoteIdea[]>();
  for (const id of ideaCommits.keys()) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) continue;
    const label = TYPE_SECTION_LABELS[entry.type ?? 'chore'];
    const ideas = bySection.get(label) ?? [];
    ideas.push({ id: entry.id, title: entry.title });
    bySection.set(label, ideas);
  }

  return SECTION_ORDER.filter((label) => bySection.has(label)).map((label) => ({
    label,
    ideas: bySection.get(label) as ReleaseNoteIdea[],
  }));
}

export function formatReleaseNotesMarkdown(
  version: string,
  sections: ReleaseNoteSection[],
): string {
  const lines = [`## ${version}`];
  for (const section of sections) {
    lines.push('', `### ${section.label}`, '');
    for (const idea of section.ideas) {
      lines.push(`- ${idea.title} (${idea.id})`);
    }
  }
  return lines.join('\n');
}
