import { Card, Input, ListItem, Stamp } from '@dendelion/paper-ui';
import { useMemo, useState } from 'react';
import { openInProject } from './open-in-project';
import { projectLabel } from './project-label';
import { useCrossProjectIdeas } from './use-cross-project-ideas';

export const CrossProjectIdeasView = () => {
  const { rows, loading } = useCrossProjectIdeas();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return rows;
    return rows.filter(({ data }) => data.title.toLowerCase().includes(needle));
  }, [rows, query]);

  return (
    <Card size="small" texture="kraft" className="flex flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Ideas</p>
      <Input
        size="small"
        label="Search"
        placeholder="Search every registered project's ideas…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading ? (
        <p className="m-0 text-sm opacity-70">Checking every registered project…</p>
      ) : filtered.length === 0 ? (
        <p className="m-0 text-sm opacity-70">
          {rows.length === 0 ? 'No ideas found across your registered projects.' : 'No matches.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {filtered.map(({ runtime, data: idea }) => (
            <ListItem
              key={`${runtime.runtimeUrl}:${idea.id ?? idea.title}`}
              size="small"
              onClick={() => {
                if (idea.id) openInProject(runtime.runtimeUrl, `/ideas/${idea.id}`);
              }}
              action={
                <Stamp size="small" variant="neutral">
                  {projectLabel(runtime)}
                </Stamp>
              }
            >
              {idea.title}
            </ListItem>
          ))}
        </div>
      )}
    </Card>
  );
};
