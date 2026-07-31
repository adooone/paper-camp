export type DiffLineType = 'add' | 'remove' | 'context';

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

// Untracked files store raw content instead of a unified diff (see git.ts
// getWorkingDiff) — synthesize a single all-added hunk so the renderer only
// has one shape to draw.
export function parsePatch(patch: string): DiffHunk[] {
  if (!patch) return [];
  const lines = (patch.endsWith('\n') ? patch.slice(0, -1) : patch).split('\n');

  if (!lines.some((line) => line.startsWith('@@ '))) {
    return [{ header: '', lines: lines.map((text) => ({ type: 'add', text })) }];
  }

  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  for (const line of lines) {
    if (line.startsWith('@@ ')) {
      current = { header: line, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue; // preamble: diff --git / index / --- / +++
    if (line.startsWith('+')) current.lines.push({ type: 'add', text: line.slice(1) });
    else if (line.startsWith('-')) current.lines.push({ type: 'remove', text: line.slice(1) });
    else current.lines.push({ type: 'context', text: line.startsWith(' ') ? line.slice(1) : line });
  }
  return hunks;
}
