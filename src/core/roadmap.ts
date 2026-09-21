import type {
  PlanEntry,
  ResolvedIdea,
  ResolvedRoadmap,
  ResolvedRoadmapItem,
  Roadmap,
  RoadmapItem,
  RoadmapItemState,
  RoadmapRollup,
  TaskLogEntry,
} from '../types/index';
import { findReleaseLineForId } from './trail';

const H2_RE = /^##\s+/;
const GOAL_HEADING_RE = /^##\s+The goal\s*$/i;
const HORIZON_HEADING_RE = /^##\s+(Horizon\s+\d+\s*[—-].*)\r?$/i;
const STANDING_CONCERNS_HEADING_RE = /^##\s+Standing concerns\s*$/i;
const ITEM_RE = /^-\s+\*\*(.+?)\*\*\s+[—-]\s+(.*)\r?$/;
const ITEM_LINK_RE = /^\s+-\s+→\s+(.+?)\r?$/;
const LINK_ID_RE = /^([A-Z]+-\d+)/;
const ITEM_SHIPPED_RE = /^\s+-\s+✓\s+shipped\s+(.+?)\r?$/;
const ITEM_CANDIDATE_RE = /^\s+-\s+(.+?)\r?$/;
const ITEM_CONTINUATION_RE = /^\s+\S/;

function parseItems(lines: string[], start: number, end: number): RoadmapItem[] {
  const items: RoadmapItem[] = [];
  let i = start;
  while (i < end) {
    const match = lines[i].match(ITEM_RE);
    if (!match) {
      i++;
      continue;
    }
    const descParts = [match[2].trim()];
    const candidates: string[] = [];
    const linked: string[] = [];
    let shippedOn: string | undefined;
    i++;
    while (i < end && !ITEM_RE.test(lines[i])) {
      const linkMatch = lines[i].match(ITEM_LINK_RE);
      if (linkMatch) {
        const linkText = linkMatch[1].trim();
        linked.push(linkText.match(LINK_ID_RE)?.[1] ?? linkText);
        i++;
        continue;
      }
      const shippedMatch = lines[i].match(ITEM_SHIPPED_RE);
      if (shippedMatch) {
        shippedOn = shippedMatch[1].trim();
        i++;
        continue;
      }
      const candidateMatch = lines[i].match(ITEM_CANDIDATE_RE);
      if (candidateMatch) {
        candidates.push(candidateMatch[1].trim());
        i++;
        continue;
      }
      if (!ITEM_CONTINUATION_RE.test(lines[i])) break;
      descParts.push(lines[i].trim());
      i++;
    }
    items.push({
      name: match[1].trim(),
      description: descParts.join(' '),
      candidates,
      linked,
      ...(shippedOn !== undefined ? { shippedOn } : {}),
    });
  }
  return items;
}

/**
 * Only `## The goal`, `## Horizon N — …`, and `## Standing concerns` headings are
 * inspected; other prose (intro, "How this file works") is skipped.
 */
export function parseRoadmap(markdown: string): Roadmap {
  const lines = markdown.split('\n');
  let goal = '';
  const horizons: Roadmap['horizons'] = [];
  let standingConcerns: Roadmap['standingConcerns'] = [];

  for (let i = 0; i < lines.length; i++) {
    if (GOAL_HEADING_RE.test(lines[i])) {
      let end = i + 1;
      while (end < lines.length && !H2_RE.test(lines[end])) end++;
      goal = lines
        .slice(i + 1, end)
        .join('\n')
        .trim();
      i = end - 1;
      continue;
    }

    const horizonMatch = lines[i].match(HORIZON_HEADING_RE);
    if (horizonMatch) {
      let end = i + 1;
      while (end < lines.length && !H2_RE.test(lines[end])) end++;
      let firstItem = i + 1;
      while (firstItem < end && !ITEM_RE.test(lines[firstItem])) firstItem++;
      const intro = lines
        .slice(i + 1, firstItem)
        .join('\n')
        .trim();
      horizons.push({
        title: horizonMatch[1].trim(),
        intro,
        items: parseItems(lines, i + 1, end),
      });
      i = end - 1;
      continue;
    }

    if (STANDING_CONCERNS_HEADING_RE.test(lines[i])) {
      let end = i + 1;
      while (end < lines.length && !H2_RE.test(lines[end])) end++;
      standingConcerns = parseItems(lines, i + 1, end);
      i = end - 1;
    }
  }

  return { goal, horizons, standingConcerns };
}

function locateHorizon(
  lines: string[],
  horizonTitle: string,
): { start: number; end: number } | undefined {
  for (let i = 0; i < lines.length; i++) {
    const horizonMatch = lines[i].match(HORIZON_HEADING_RE);
    if (!horizonMatch || horizonMatch[1].trim() !== horizonTitle) continue;

    let end = i + 1;
    while (end < lines.length && !H2_RE.test(lines[end])) end++;
    return { start: i + 1, end };
  }
  return undefined;
}

// Locates one item's bullet range (start inclusive, end exclusive of continuations/candidates)
// so the mutators below share one scan instead of each re-walking the structure.
function locateItem(
  lines: string[],
  horizonTitle: string,
  itemName: string,
): { start: number; end: number } | undefined {
  const horizon = locateHorizon(lines, horizonTitle);
  if (!horizon) return undefined;

  for (let j = horizon.start; j < horizon.end; j++) {
    const itemMatch = lines[j].match(ITEM_RE);
    if (!itemMatch || itemMatch[1].trim() !== itemName) continue;

    let itemEnd = j + 1;
    while (itemEnd < horizon.end && !ITEM_RE.test(lines[itemEnd])) {
      if (!ITEM_CONTINUATION_RE.test(lines[itemEnd])) break;
      itemEnd++;
    }
    return { start: j, end: itemEnd };
  }
  return undefined;
}

/**
 * Removes one item's bullet (with its continuation lines and candidates), or — if
 * `candidateName` is given — just that one candidate bullet, leaving the item in place.
 */
export function removeRoadmapItem(
  markdown: string,
  horizonTitle: string,
  itemName: string,
  candidateName?: string,
): string {
  const lines = markdown.split('\n');
  const item = locateItem(lines, horizonTitle, itemName);
  if (!item) return markdown;

  if (candidateName === undefined) {
    lines.splice(item.start, item.end - item.start);
    return lines.join('\n');
  }

  for (let k = item.start + 1; k < item.end; k++) {
    const candidateMatch = lines[k].match(ITEM_CANDIDATE_RE);
    if (candidateMatch && candidateMatch[1].trim() === candidateName) {
      lines.splice(k, 1);
      return lines.join('\n');
    }
  }
  return markdown;
}

/**
 * Appends a new item bullet (`- **name** — description`) at the end of a horizon's
 * item list, in the shape parseItems expects. No-op if the horizon doesn't exist.
 */
export function addRoadmapItem(
  markdown: string,
  horizonTitle: string,
  name: string,
  description: string,
): string {
  const lines = markdown.split('\n');
  const horizon = locateHorizon(lines, horizonTitle);
  if (!horizon) return markdown;

  let end = horizon.end;
  while (end > horizon.start && lines[end - 1].trim() === '') end--;
  lines.splice(end, 0, `- **${name}** — ${description}`);
  return lines.join('\n');
}

// Appends a new candidate bullet under an existing item, indented to match ITEM_CANDIDATE_RE.
// No-op if the horizon or item doesn't exist.
export function addRoadmapCandidate(
  markdown: string,
  horizonTitle: string,
  itemName: string,
  candidateName: string,
): string {
  const lines = markdown.split('\n');
  const item = locateItem(lines, horizonTitle, itemName);
  if (!item) return markdown;

  lines.splice(item.end, 0, `  - ${candidateName}`);
  return lines.join('\n');
}

// Appends a link bullet (`  - → entityId`) under an existing item, indented to match
// ITEM_LINK_RE. No-op if the horizon or item doesn't exist.
export function linkRoadmapItem(
  markdown: string,
  horizonTitle: string,
  itemName: string,
  entityId: string,
): string {
  const lines = markdown.split('\n');
  const item = locateItem(lines, horizonTitle, itemName);
  if (!item) return markdown;

  lines.splice(item.end, 0, `  - → ${entityId}`);
  return lines.join('\n');
}

/**
 * The subject vocabulary in order: horizon items (H1 near-term → H3 long bets), then
 * standing concerns last. The one ordered read every subject picker/grouping should use.
 */
export function deriveSubjectVocabulary(roadmap: Roadmap): string[] {
  return [
    ...roadmap.horizons.flatMap((horizon) => horizon.items.map((item) => item.name)),
    ...roadmap.standingConcerns.map((item) => item.name),
  ];
}

// An item's ideas: entities whose subject names it, joined with its linked ids,
// deduplicated by id — the linked join catches an idea whose subject drifted or was
// never set, the subject join catches one a human forgot to link by hand.
function resolveIdeas(
  item: RoadmapItem,
  entities: PlanEntry[],
  entityById: Map<string, PlanEntry>,
  changelog: string,
): ResolvedIdea[] {
  const byId = new Map<string, PlanEntry>();
  for (const entity of entities) {
    if (entity.id && entity.subject === item.name) byId.set(entity.id, entity);
  }
  for (const id of item.linked) {
    const entity = entityById.get(id);
    if (entity) byId.set(id, entity);
  }
  return [...byId.entries()].map(([id, entity]) => ({
    id,
    title: entity.title,
    status: entity.status,
    pr: entity.pr,
    released: findReleaseLineForId(changelog, id) !== undefined,
  }));
}

function rollupIdeas(ideas: ResolvedIdea[]): RoadmapRollup {
  const nonDropped = ideas.filter((idea) => idea.status !== 'dropped');
  const done = nonDropped.filter((idea) => idea.status === 'done').length;
  return { total: nonDropped.length, done, open: nonDropped.length - done };
}

// A subject can always take one more idea, so "every idea is done" only offers
// readyToShip — only a person marking the item shipped (IDEA-277) makes it final.
function deriveItemState(
  item: RoadmapItem,
  rollup: RoadmapRollup,
): { state: RoadmapItemState; readyToShip: boolean } {
  if (item.shippedOn !== undefined) return { state: 'shipped', readyToShip: false };
  if (rollup.total === 0) return { state: 'not-started', readyToShip: false };
  return { state: 'in-progress', readyToShip: rollup.done === rollup.total };
}

function resolveItem(
  item: RoadmapItem,
  entities: PlanEntry[],
  entityById: Map<string, PlanEntry>,
  taskRunsById: Map<string, number>,
  changelog: string,
): ResolvedRoadmapItem {
  const links = item.linked.flatMap((id) => {
    const entity = entityById.get(id);
    if (!entity?.status) return [];
    return [
      {
        id,
        status: entity.status,
        taskRuns: taskRunsById.get(id) ?? 0,
        pr: entity.pr,
        released: findReleaseLineForId(changelog, id) !== undefined,
      },
    ];
  });
  const ideas = resolveIdeas(item, entities, entityById, changelog);
  const rollup = rollupIdeas(ideas);
  const { state, readyToShip } = deriveItemState(item, rollup);
  return { ...item, links, ideas, rollup, state, readyToShip };
}

export function resolveRoadmap(
  roadmap: Roadmap,
  entities: PlanEntry[],
  taskLog: TaskLogEntry[] = [],
  changelog = '',
): ResolvedRoadmap {
  const entityById = new Map(entities.filter((e) => e.id).map((e) => [e.id as string, e]));
  const taskRunsById = new Map<string, number>();
  for (const task of taskLog) {
    if (!task.planId) continue;
    taskRunsById.set(task.planId, (taskRunsById.get(task.planId) ?? 0) + 1);
  }

  const horizons = roadmap.horizons.map((horizon) => {
    const items = horizon.items.map((item) =>
      resolveItem(item, entities, entityById, taskRunsById, changelog),
    );
    const rollup = items.reduce(
      (acc, item) => ({
        total: acc.total + item.rollup.total,
        done: acc.done + item.rollup.done,
        open: acc.open + item.rollup.open,
      }),
      { total: 0, done: 0, open: 0 },
    );
    return { title: horizon.title, items, rollup };
  });

  const standingConcerns = roadmap.standingConcerns.map((item) =>
    resolveItem(item, entities, entityById, taskRunsById, changelog),
  );

  const subjectVocabulary = new Set(deriveSubjectVocabulary(roadmap));
  const unfiled = entities.filter(
    (entity) => !entity.subject || !subjectVocabulary.has(entity.subject),
  );

  return { goal: roadmap.goal, horizons, standingConcerns, unfiled };
}
