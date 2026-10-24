import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EntityType, ReleaseNoteIdea, ReleaseNoteSection } from '../types/index';
import { splitPrefix } from './git-log';
import { readEntities } from './readers';
import { readFileMaybe, resolveReleaseCommits, resolveReleaseRanges } from './trail';

const TYPE_SECTION_LABELS: Record<EntityType, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  refactor: 'Code Refactoring',
  docs: 'Documentation',
  chore: 'Miscellaneous',
};

const SECTION_ORDER = Array.from(new Set(Object.values(TYPE_SECTION_LABELS)));

function resolveCommitType(subject: string): EntityType {
  const { prefix } = splitPrefix(subject);
  const type = prefix.split('(', 1)[0].toLowerCase();
  return type in TYPE_SECTION_LABELS ? (type as EntityType) : 'chore';
}

function push(
  bySection: Map<string, ReleaseNoteIdea[]>,
  label: string,
  idea: ReleaseNoteIdea,
): void {
  const ideas = bySection.get(label) ?? [];
  ideas.push(idea);
  bySection.set(label, ideas);
}

/** One row per idea rather than per commit: dedupes a fix-up commit into the idea's
 * initial row and swaps in the idea's title, so a release reads as shipped ideas, not raw commits.
 * A commit with no idea reference keeps its own row, so a hand-made fix on main still gets a line. */
export async function resolveReleaseNotes(
  root: string,
  version: string,
): Promise<ReleaseNoteSection[] | null> {
  const changelog = await readFileMaybe(join(root, 'CHANGELOG.md'));
  const release = resolveReleaseRanges(changelog).find((r) => r.version === version);
  if (!release) return null;

  const [{ entries }, commits] = await Promise.all([
    readEntities(join(root, 'papercamp', 'ideas')),
    resolveReleaseCommits(root, release.range),
  ]);

  const bySection = new Map<string, ReleaseNoteIdea[]>();
  const seenIdeas = new Set<string>();
  for (const commit of commits) {
    if (commit.id) {
      if (seenIdeas.has(commit.id)) continue;
      const entry = entries.find((e) => e.id === commit.id);
      if (!entry) continue;
      seenIdeas.add(commit.id);
      push(bySection, TYPE_SECTION_LABELS[entry.type ?? 'chore'], {
        id: entry.id,
        title: entry.title,
      });
    } else {
      const label = TYPE_SECTION_LABELS[resolveCommitType(commit.subject)];
      push(bySection, label, { title: splitPrefix(commit.subject).subject });
    }
  }

  return SECTION_ORDER.filter((label) => bySection.has(label)).map((label) => ({
    label,
    ideas: bySection.get(label) as ReleaseNoteIdea[],
  }));
}

function formatReleaseNoteIdea(idea: ReleaseNoteIdea): string {
  return idea.id ? `- **${idea.title}** (${idea.id})` : `- ${idea.title}`;
}

export function formatReleaseNotesMarkdown(
  version: string,
  sections: ReleaseNoteSection[],
): string {
  const lines = [`## ${version}`];
  for (const section of sections) {
    lines.push('', `### ${section.label}`, '');
    for (const idea of section.ideas) {
      lines.push(formatReleaseNoteIdea(idea));
    }
  }
  return lines.join('\n');
}

const CHANGELOG_RELEASE_HEADER_RE = /^## \[.+?\]\(.*\/compare\/(.+?)\.\.\.(.+?)\)/;

/** Replaces the version's section in CHANGELOG.md with the grouped notes, keeping the
 * release-please header line (its date and compare link) as-is, and returns the printed
 * section. Running this twice over the same PR is a no-op: the second pass reads back the
 * section it just wrote and regroups it to the same result. */
export async function writeReleaseNotes(root: string, version: string): Promise<string | null> {
  const changelogPath = join(root, 'CHANGELOG.md');
  const changelog = await readFileMaybe(changelogPath);
  const lines = changelog.split('\n');

  const headerIndex = lines.findIndex(
    (line) => CHANGELOG_RELEASE_HEADER_RE.exec(line)?.[2] === version,
  );
  if (headerIndex === -1) return null;

  const sections = await resolveReleaseNotes(root, version);
  if (!sections) return null;

  let endIndex = lines.findIndex((line, i) => i > headerIndex && /^## /.test(line));
  if (endIndex === -1) endIndex = lines.length;

  const header = lines[headerIndex];
  const bodyLines = formatReleaseNotesMarkdown(version, sections).split('\n').slice(1);
  const after = lines.slice(endIndex);

  const updated = [...lines.slice(0, headerIndex), header, ...bodyLines, '', ...after].join('\n');

  await writeFile(changelogPath, updated);
  return [header, ...bodyLines].join('\n');
}
