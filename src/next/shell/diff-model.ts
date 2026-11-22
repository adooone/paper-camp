import type { FileDiffEntry } from '@/types/index';

export const COLLAPSE_LINE_THRESHOLD = 60;

export type DiffBody = { kind: 'code'; code: string } | { kind: 'note'; text: string };

export function diffBody(entry: FileDiffEntry): DiffBody {
  if (entry.binary) return { kind: 'note', text: 'Binary file not shown.' };
  if (entry.contentKind === 'too-large')
    return { kind: 'note', text: 'File too large to preview.' };
  if (entry.patch.trim() !== '') return { kind: 'code', code: entry.patch.replace(/\n$/, '') };
  if (entry.renameSource) {
    const unchanged = entry.additions === 0 && entry.deletions === 0;
    return {
      kind: 'note',
      text: unchanged
        ? 'Renamed, no content changes.'
        : 'Renamed with unrelated content — diff omitted.',
    };
  }
  return { kind: 'note', text: 'No changes to preview.' };
}

export function isDiffCollapsed(
  entry: FileDiffEntry,
  override: { expanded: boolean; collapsed: boolean },
): boolean {
  if (override.collapsed) return true;
  if (override.expanded) return false;
  return entry.additions + entry.deletions > COLLAPSE_LINE_THRESHOLD;
}

export function diffCounts(entry: FileDiffEntry): string | null {
  if (entry.binary) return null;
  return `+${entry.additions} −${entry.deletions}`;
}

export function diffPathLabel(entry: FileDiffEntry): string {
  return entry.renameSource ? `${entry.renameSource} → ${entry.path}` : entry.path;
}

export function diffSummary(files: FileDiffEntry[]): string {
  if (files.length === 0) return 'The working tree is clean.';
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  return `${files.length} ${files.length === 1 ? 'file' : 'files'} · +${additions} −${deletions}`;
}
