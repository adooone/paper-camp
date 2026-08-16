export type DiffLineType = 'add' | 'remove' | 'context';

export interface DiffLine {
  type: DiffLineType;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

// Parses a unified diff (git.ts getWorkingDiff, contentKind: 'diff'). A real diff
// with no hunks (pure rename, mode-only change) is just the preamble, so it yields [].
export function parsePatch(patch: string): DiffHunk[] {
  if (!patch) return [];
  const lines = (patch.endsWith('\n') ? patch.slice(0, -1) : patch).split('\n');

  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;
  for (const line of lines) {
    const header = line.match(HUNK_HEADER);
    if (header) {
      current = { header: line, lines: [] };
      hunks.push(current);
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      continue;
    }
    if (!current) continue; // preamble: diff --git / index / --- / +++
    if (line.startsWith('\\')) continue; // "\ No newline at end of file"
    if (line.startsWith('+')) {
      current.lines.push({ type: 'add', text: line.slice(1), oldLine: null, newLine });
      newLine++;
    } else if (line.startsWith('-')) {
      current.lines.push({ type: 'remove', text: line.slice(1), oldLine, newLine: null });
      oldLine++;
    } else {
      current.lines.push({
        type: 'context',
        text: line.startsWith(' ') ? line.slice(1) : line,
        oldLine,
        newLine,
      });
      oldLine++;
      newLine++;
    }
  }
  return hunks;
}

// Untracked files store raw content, not a diff (git.ts getWorkingDiff, contentKind:
// 'raw') — synthesize a single all-added hunk so the renderer only has one shape to draw.
export function rawContentHunks(content: string): DiffHunk[] {
  if (!content) return [];
  const lines = (content.endsWith('\n') ? content.slice(0, -1) : content).split('\n');
  return [
    {
      header: '',
      lines: lines.map((text, i) => ({ type: 'add', text, oldLine: null, newLine: i + 1 })),
    },
  ];
}
