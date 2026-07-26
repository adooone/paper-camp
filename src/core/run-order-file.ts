export interface RunOrderFileEntry {
  id: string;
  title: string;
}

const LINE_SEPARATOR = ' — ';

/** First line runs first; blank lines are skipped so trailing newlines round-trip cleanly. */
export function parseRunOrderFile(content: string): RunOrderFileEntry[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const sepIndex = line.indexOf(LINE_SEPARATOR);
      if (sepIndex === -1) return { id: line, title: '' };
      return {
        id: line.slice(0, sepIndex).trim(),
        title: line.slice(sepIndex + LINE_SEPARATOR.length).trim(),
      };
    });
}

export function formatRunOrderFile(entries: RunOrderFileEntry[]): string {
  if (entries.length === 0) return '';
  return `${entries.map((e) => `${e.id}${LINE_SEPARATOR}${e.title}`).join('\n')}\n`;
}
