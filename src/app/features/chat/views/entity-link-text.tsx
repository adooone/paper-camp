import { entityLink, useIdeas } from '@/app/hooks';
import type { IdeaEntry } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

const ENTITY_LINK_RE = /\[\[(IDEA-\d+)\]\]|\b(IDEA-\d+)\b/g;

export interface EntityLinkMatch {
  id: string;
  label: string;
  start: number;
  end: number;
}

export function parseEntityLinks(
  text: string,
  ideas: Pick<IdeaEntry, 'id' | 'title'>[],
): EntityLinkMatch[] {
  const matches: EntityLinkMatch[] = [];
  const re = new RegExp(ENTITY_LINK_RE);
  for (let match = re.exec(text); match; match = re.exec(text)) {
    const id = match[1] ?? match[2];
    const idea = ideas.find((i) => i.id?.toUpperCase() === id.toUpperCase());
    matches.push({
      id,
      label: idea ? `${id} · ${idea.title}` : id,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return matches;
}

const linkButtonClass =
  'inline bg-none bg-transparent border-none p-0 m-0 cursor-pointer [font:inherit] underline text-watercolor-amber-dark';

interface EntityLinkTextProps {
  text: string;
}

export const EntityLinkText = ({ text }: EntityLinkTextProps) => {
  const ideas = useIdeas();
  const navigate = useNavigate();
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  for (const m of parseEntityLinks(text, ideas)) {
    if (m.start > lastIndex) nodes.push(text.slice(lastIndex, m.start));
    nodes.push(
      <button
        key={`${m.id}-${m.start}`}
        type="button"
        onClick={() => navigate(entityLink({ id: m.id, title: m.label }))}
        className={linkButtonClass}
      >
        {m.label}
      </button>,
    );
    lastIndex = m.end;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
};
