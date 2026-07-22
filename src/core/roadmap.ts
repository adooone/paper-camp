import type { Roadmap, RoadmapItem } from '../types/index';

const H2_RE = /^##\s+/;
const GOAL_HEADING_RE = /^##\s+The goal\s*$/i;
const HORIZON_HEADING_RE = /^##\s+(Horizon\s+\d+\s*[—-].*)\r?$/i;
const ITEM_RE = /^-\s+\*\*(.+?)\*\*\s+[—-]\s+(.*)\r?$/;
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
    i++;
    while (i < end && !ITEM_RE.test(lines[i])) {
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
    items.push({ name: match[1].trim(), description: descParts.join(' '), candidates });
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
