import type {
  PlanEntry,
  ProgressEntry,
  ResolvedRoadmap,
  Roadmap,
  RoadmapEvent,
  RoadmapItem,
  TaskLogEntry,
} from '../types/index';

const H2_RE = /^##\s+/;
const GOAL_HEADING_RE = /^##\s+The goal\s*$/i;
const HORIZON_HEADING_RE = /^##\s+(Horizon\s+\d+\s*[—-].*)\r?$/i;
const ITEM_RE = /^-\s+\*\*(.+?)\*\*\s+[—-]\s+(.*)\r?$/;
const ITEM_LINK_RE = /^\s+-\s+→\s+(.+?)\r?$/;
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
    i++;
    while (i < end && !ITEM_RE.test(lines[i])) {
      const linkMatch = lines[i].match(ITEM_LINK_RE);
      if (linkMatch) {
        linked.push(linkMatch[1].trim());
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
    items.push({ name: match[1].trim(), description: descParts.join(' '), candidates, linked });
  }
  return items;
}

// Tolerant of prose anywhere outside the load-bearing headings: only `## The goal` and
// `## Horizon N — …` are ever inspected, everything else (intro, "How this file works") is skipped.
export function parseRoadmap(markdown: string): Roadmap {
  const lines = markdown.split('\n');
  let goal = '';
  const horizons: Roadmap['horizons'] = [];

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
      horizons.push({ title: horizonMatch[1].trim(), items: parseItems(lines, i + 1, end) });
      i = end - 1;
    }
  }

  return { goal, horizons };
}

// Splices out one item's bullet (and its wrapped continuation lines and candidates) so the
// round trip through parseRoadmap sees one fewer item and nothing else changes — used to
// promote an item into an idea while keeping the roadmap the honest map of what hasn't started.
// Passing candidateName instead removes just that one candidate bullet, leaving the item in place.
export function removeRoadmapItem(
  markdown: string,
  horizonTitle: string,
  itemName: string,
  candidateName?: string,
): string {
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const horizonMatch = lines[i].match(HORIZON_HEADING_RE);
    if (!horizonMatch || horizonMatch[1].trim() !== horizonTitle) continue;

    let end = i + 1;
    while (end < lines.length && !H2_RE.test(lines[end])) end++;

    for (let j = i + 1; j < end; j++) {
      const itemMatch = lines[j].match(ITEM_RE);
      if (!itemMatch || itemMatch[1].trim() !== itemName) continue;

      let itemEnd = j + 1;
      while (itemEnd < end && !ITEM_RE.test(lines[itemEnd])) {
        if (!ITEM_CONTINUATION_RE.test(lines[itemEnd])) break;
        itemEnd++;
      }

      if (candidateName === undefined) {
        lines.splice(j, itemEnd - j);
        return lines.join('\n');
      }

      for (let k = j + 1; k < itemEnd; k++) {
        const candidateMatch = lines[k].match(ITEM_CANDIDATE_RE);
        if (candidateMatch && candidateMatch[1].trim() === candidateName) {
          lines.splice(k, 1);
          return lines.join('\n');
        }
      }
      return markdown;
    }
    return markdown;
  }

  return markdown;
}

// Appends a new item bullet (`- **name** — description`) at the end of a horizon's item
// list, in the same shape parseItems expects back. No-op (returns markdown unchanged) if
// the horizon doesn't exist.
export function addRoadmapItem(
  markdown: string,
  horizonTitle: string,
  name: string,
  description: string,
): string {
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const horizonMatch = lines[i].match(HORIZON_HEADING_RE);
    if (!horizonMatch || horizonMatch[1].trim() !== horizonTitle) continue;

    let end = i + 1;
    while (end < lines.length && !H2_RE.test(lines[end])) end++;

    while (end > i + 1 && lines[end - 1].trim() === '') end--;
    lines.splice(end, 0, `- **${name}** — ${description}`);
    return lines.join('\n');
  }

  return markdown;
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

  for (let i = 0; i < lines.length; i++) {
    const horizonMatch = lines[i].match(HORIZON_HEADING_RE);
    if (!horizonMatch || horizonMatch[1].trim() !== horizonTitle) continue;

    let end = i + 1;
    while (end < lines.length && !H2_RE.test(lines[end])) end++;

    for (let j = i + 1; j < end; j++) {
      const itemMatch = lines[j].match(ITEM_RE);
      if (!itemMatch || itemMatch[1].trim() !== itemName) continue;

      let itemEnd = j + 1;
      while (itemEnd < end && !ITEM_RE.test(lines[itemEnd])) {
        if (!ITEM_CONTINUATION_RE.test(lines[itemEnd])) break;
        itemEnd++;
      }

      lines.splice(itemEnd, 0, `  - ${candidateName}`);
      return lines.join('\n');
    }
    return markdown;
  }

  return markdown;
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

  for (let i = 0; i < lines.length; i++) {
    const horizonMatch = lines[i].match(HORIZON_HEADING_RE);
    if (!horizonMatch || horizonMatch[1].trim() !== horizonTitle) continue;

    let end = i + 1;
    while (end < lines.length && !H2_RE.test(lines[end])) end++;

    for (let j = i + 1; j < end; j++) {
      const itemMatch = lines[j].match(ITEM_RE);
      if (!itemMatch || itemMatch[1].trim() !== itemName) continue;

      let itemEnd = j + 1;
      while (itemEnd < end && !ITEM_RE.test(lines[itemEnd])) {
        if (!ITEM_CONTINUATION_RE.test(lines[itemEnd])) break;
        itemEnd++;
      }

      lines.splice(itemEnd, 0, `  - → ${entityId}`);
      return lines.join('\n');
    }
    return markdown;
  }

  return markdown;
}

export function resolveRoadmap(roadmap: Roadmap, entities: PlanEntry[]): ResolvedRoadmap {
  const statusById = new Map(entities.filter((e) => e.id).map((e) => [e.id, e.status]));

  const horizons = roadmap.horizons.map((horizon) => {
    const items = horizon.items.map((item) => {
      const links = item.linked.flatMap((id) => {
        const status = statusById.get(id);
        return status ? [{ id, status }] : [];
      });
      const rollup = { total: links.length, done: links.filter((l) => l.status === 'done').length };
      return { ...item, links, rollup };
    });
    const rollup = items.reduce(
      (acc, item) => ({
        total: acc.total + item.rollup.total,
        done: acc.done + item.rollup.done,
      }),
      { total: 0, done: 0 },
    );
    return { title: horizon.title, items, rollup };
  });

  return { goal: roadmap.goal, horizons };
}

const WIKI_LINK_RE = /\[\[([A-Z]+-\d+)\]\]/g;

// One chronological model over three append-only sources, each keyed back to the roadmap item
// (via its `linked` entity ids) and the entity it happened to. `updated` is deliberately excluded —
// see IDEA-92's Timeline phase for why a last-touched timestamp can't stand in for history.
export function deriveRoadmapEvents(
  roadmap: Roadmap,
  entities: PlanEntry[],
  taskLog: TaskLogEntry[],
  progress: ProgressEntry[],
): RoadmapEvent[] {
  const itemByEntityId = new Map<string, { horizonTitle: string; itemName: string }>();
  for (const horizon of roadmap.horizons) {
    for (const item of horizon.items) {
      for (const id of item.linked) {
        itemByEntityId.set(id, { horizonTitle: horizon.title, itemName: item.name });
      }
    }
  }

  const events: RoadmapEvent[] = [];

  for (const entity of entities) {
    if (!entity.id) continue;
    const item = itemByEntityId.get(entity.id);
    if (!item) continue;
    events.push({
      date: entity.created,
      kind: 'created',
      entityId: entity.id,
      horizonTitle: item.horizonTitle,
      itemName: item.itemName,
      label: `${entity.title} created`,
    });
  }

  for (const task of taskLog) {
    if (!task.planId) continue;
    const item = itemByEntityId.get(task.planId);
    if (!item) continue;
    events.push({
      date: task.startedAt,
      kind: 'task-run',
      entityId: task.planId,
      horizonTitle: item.horizonTitle,
      itemName: item.itemName,
      label: `${task.taskKind} run (${task.outcome})`,
    });
  }

  for (const entry of progress) {
    for (const line of entry.items) {
      const ids = new Set(Array.from(line.matchAll(WIKI_LINK_RE), (m) => m[1]));
      for (const id of ids) {
        const item = itemByEntityId.get(id);
        if (!item) continue;
        events.push({
          date: entry.date,
          kind: 'progress',
          entityId: id,
          horizonTitle: item.horizonTitle,
          itemName: item.itemName,
          label: line,
        });
      }
    }
  }

  return events.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
