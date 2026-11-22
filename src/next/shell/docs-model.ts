import type { ReleaseNoteSection } from '@/types/index';

export interface RepoDoc {
  name: string;
  content: string;
}

export interface DocMatch {
  name: string;
  snippet: string;
}

const SNIPPET_LENGTH = 120;
const SNIPPET_CONTEXT = 40;

export const isMarkdownDoc = (name: string): boolean => name.endsWith('.md');

const contains = (text: string, query: string): boolean =>
  text.toLowerCase().includes(query.toLowerCase());

export function snippetAround(text: string, query: string): string {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return text.slice(0, SNIPPET_LENGTH);
  const start = Math.max(0, at - SNIPPET_CONTEXT);
  const end = Math.min(text.length, at + query.length + SNIPPET_CONTEXT);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export function searchDocs(docs: RepoDoc[], query: string): DocMatch[] {
  const needle = query.trim();
  if (!needle) return [];
  return docs
    .filter((doc) => contains(doc.name, needle) || contains(doc.content, needle))
    .map((doc) => ({ name: doc.name, snippet: snippetAround(doc.content, needle) }));
}

export function releaseMarkdown(sections: ReleaseNoteSection[]): string {
  return sections
    .map(
      (section) =>
        `### ${section.label}\n\n${section.ideas
          .map((idea) => (idea.id ? `- **${idea.title}** (${idea.id})` : `- ${idea.title}`))
          .join('\n')}`,
    )
    .join('\n\n');
}

export const RELEASES_PAGE_SIZE = 10;

export const resultsLine = (count: number, query: string): string =>
  `${count} ${count === 1 ? 'result' : 'results'} for "${query.trim()}"`;
