import { Markdown } from '@/app/components/markdown';
import { PageTitle } from '@/app/components/page-title';
import { PrBadge } from '@/app/features/plans/components/pr-badge';
import { STATUS_LABEL, STATUS_STAMP } from '@/app/features/plans/constants';
import { addRoadmapCandidate, addRoadmapItem, fetchRoadmap } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import type {
  PlanEntry,
  PlanStatus,
  PrInfo,
  ResolvedRoadmap,
  ResolvedRoadmapItem,
  RoadmapLink,
} from '@/types/index';
import { Button, Card, Input, Stamp } from '@dendelion/paper-ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { PromoteRoadmapItemModal } from './promote-roadmap-item-modal';

const graduationCounts = (graduated: PlanEntry[]) => ({
  shipped: graduated.filter((p) => p.status === 'done').length,
  queued: graduated.filter((p) => p.status !== 'done' && p.status !== 'dropped').length,
});

const HORIZON_HEADER_CLASSES =
  'font-handwritten text-md font-semibold opacity-70 leading-none pt-2 px-1 pb-0';

const HORIZON_PULSE_CLASSES = 'text-2xs font-normal px-1 py-0 opacity-50';

const ChevronRightIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const CandidateRow = ({
  name,
  onPromote,
}: {
  name: string;
  onPromote: () => void;
}) => (
  <Card size="small" texture="kraft" className="plan-row-card">
    <div className="flex items-center gap-3">
      <span className="flex-1">{name}</span>
      <Button type="button" variant="ghost" size="small" onClick={onPromote}>
        Promote to idea
      </Button>
    </div>
  </Card>
);

const AddCandidateForm = ({ onAdd }: { onAdd: (name: string) => Promise<void> }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onAdd(name.trim());
      setName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        size="small"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd();
        }}
        placeholder="Add option…"
        disabled={saving}
        className="flex-1"
      />
      <Button
        type="button"
        variant="ghost"
        size="small"
        onClick={handleAdd}
        disabled={saving || !name.trim()}
      >
        Add
      </Button>
    </div>
  );
};

const AddItemForm = ({
  onAdd,
}: {
  onAdd: (name: string, description: string) => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onAdd(name.trim(), description.trim());
      setName('');
      setDescription('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="small" onClick={() => setOpen(true)}>
        + Add item
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        size="small"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name…"
        disabled={saving}
        autoFocus
      />
      <Input
        size="small"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd();
        }}
        placeholder="Description…"
        disabled={saving}
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="small"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="button" size="small" onClick={handleAdd} disabled={saving || !name.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
};

interface MergedIdea {
  key: string;
  label: string;
  status: PlanStatus;
  pr?: PrInfo;
  planTitle?: string;
}

const mergeIdeas = (links: RoadmapLink[], graduated: PlanEntry[]): MergedIdea[] => {
  const represented = new Set<string>();
  const merged: MergedIdea[] = graduated.map((plan) => {
    if (plan.id) represented.add(plan.id);
    if (plan.idea) represented.add(plan.idea);
    return {
      key: plan.title,
      label: plan.title,
      status: plan.status,
      pr: plan.pr,
      planTitle: plan.title,
    };
  });
  for (const link of links) {
    if (represented.has(link.id)) continue;
    merged.push({ key: link.id, label: link.id, status: link.status, pr: link.pr });
  }
  return merged;
};

const IdeaRow = ({ idea, onOpen }: { idea: MergedIdea; onOpen?: () => void }) => (
  <Card size="small" texture="kraft" className="plan-row-card">
    <div className="flex items-center gap-3">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left"
        >
          {idea.label}
        </button>
      ) : (
        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {idea.label}
        </span>
      )}
      {idea.pr && <PrBadge pr={idea.pr} />}
      <Stamp
        size="small"
        fillColor={STATUS_STAMP[idea.status].fill}
        textColor={STATUS_STAMP[idea.status].text}
      >
        {STATUS_LABEL[idea.status]}
      </Stamp>
    </div>
  </Card>
);

const ProgressBar = ({ done, total }: { done: number; total: number }) => {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="w-24 h-1.5 rounded-full bg-black/[0.08] overflow-hidden shrink-0">
      <div
        className={`h-full rounded-full ${total > 0 ? 'bg-watercolor-green' : 'bg-transparent'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

const RoadmapItemRow = ({
  item,
  graduated,
  highlighted,
  onPromote,
  onPromoteCandidate,
  onAddCandidate,
  onOpenGraduated,
}: {
  item: ResolvedRoadmapItem;
  graduated: PlanEntry[];
  highlighted: boolean;
  onPromote: () => void;
  onPromoteCandidate: (candidateName: string) => void;
  onAddCandidate: (name: string) => Promise<void>;
  onOpenGraduated: (title: string) => void;
}) => {
  const [expanded, setExpanded] = useState(highlighted);
  const { shipped, queued } = graduationCounts(graduated);
  const candidates = item.candidates.length;
  const ideas = mergeIdeas(item.links, graduated);

  return (
    <div
      className={`flex flex-col gap-1 ${highlighted ? 'roadmap-item-highlighted outline outline-2 outline-offset-[-2px] outline-[rgba(200,154,90,0.5)]' : ''}`}
    >
      <Card size="small" texture="canvas" className="plan-row-card">
        <div className="flex items-center gap-2">
          {/* Raw <button>: icon-only toggle, paper-ui Button doesn't offer this compact chrome. */}
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse item' : 'Expand item'}
            onClick={() => setExpanded((v) => !v)}
            className={`inline-flex items-center bg-transparent border-none cursor-pointer opacity-50 p-0 ${expanded ? 'rotate-90' : ''}`}
          >
            <ChevronRightIcon />
          </button>
          <span className="font-semibold flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {item.name}
          </span>
          <ProgressBar done={item.rollup.done} total={item.rollup.total} />
          {queued > 0 && (
            <Stamp
              size="small"
              fillColor={STATUS_STAMP.planned.fill}
              textColor={STATUS_STAMP.planned.text}
            >
              {queued} in queue
            </Stamp>
          )}
          {shipped > 0 && (
            <Stamp
              size="small"
              fillColor={STATUS_STAMP.done.fill}
              textColor={STATUS_STAMP.done.text}
            >
              {shipped} shipped
            </Stamp>
          )}
          {candidates > 0 && (
            <Stamp size="small" fillColor="rgba(0, 0, 0, 0.06)" textColor="rgba(0, 0, 0, 0.55)">
              {candidates} candidate{candidates === 1 ? '' : 's'}
            </Stamp>
          )}
        </div>
      </Card>
      {expanded && (
        <div className="flex flex-col gap-1 pl-6">
          <span className="text-sm opacity-70">{item.description}</span>
          {ideas.map((idea) => (
            <IdeaRow
              key={idea.key}
              idea={idea}
              onOpen={idea.planTitle ? () => onOpenGraduated(idea.planTitle as string) : undefined}
            />
          ))}
          {item.candidates.map((candidateName) => (
            <CandidateRow
              key={candidateName}
              name={candidateName}
              onPromote={() => onPromoteCandidate(candidateName)}
            />
          ))}
          <AddCandidateForm onAdd={onAddCandidate} />
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={onPromote}
            className="self-start"
          >
            Promote to idea
          </Button>
        </div>
      )}
    </div>
  );
};

const GoalBanner = ({ goal }: { goal: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [firstParagraph, ...restParagraphs] = goal.split(/\n{2,}/);
  const hasMore = restParagraphs.length > 0;

  return (
    <div className="mb-6 pb-4 border-b border-black/[8%]">
      <span className="font-handwritten text-xs font-semibold opacity-[0.55]">The goal</span>
      <div className="font-display-luminari text-lg leading-[1.4] mt-2">
        <div className={expanded ? undefined : 'line-clamp-1'}>
          <Markdown>{firstParagraph}</Markdown>
        </div>
        {expanded && hasMore && <Markdown>{restParagraphs.join('\n\n')}</Markdown>}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="bg-transparent border-none p-0 mt-2 cursor-pointer text-2xs opacity-[0.65] underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

const HorizonPulse = ({
  items,
  graduatedByItem,
}: {
  items: ResolvedRoadmapItem[];
  graduatedByItem: (item: ResolvedRoadmapItem) => PlanEntry[];
}) => {
  const graduated = items.filter((item) => graduatedByItem(item).length > 0).length;
  const charted = items.length - graduated;
  return (
    <div className={HORIZON_PULSE_CLASSES}>
      {graduated} graduated · {charted} charted
    </div>
  );
};

export const RoadmapPage = () => {
  const [roadmap, setRoadmap] = useState<ResolvedRoadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [promoting, setPromoting] = useState<{
    horizonTitle: string;
    item: ResolvedRoadmapItem;
    candidateName?: string;
  } | null>(null);
  const plans = useAppStore((s) => s.plans);
  const navigate = useNavigate();
  const { item: highlightedItem } = useSearch({ from: '/roadmap' });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRoadmap()
      .then(setRoadmap)
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!highlightedItem || loading) return;
    const row = containerRef.current?.querySelector('.roadmap-item-highlighted');
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedItem, loading]);

  if (loading) {
    return (
      <div>
        <PageTitle>Roadmap</PageTitle>
        <p className="opacity-50">Loading…</p>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div>
        <PageTitle>Roadmap</PageTitle>
        <p className="opacity-50">
          Couldn't load the roadmap — the server may need a restart to pick up new routes.
        </p>
      </div>
    );
  }

  if (!roadmap || roadmap.horizons.length === 0) {
    return (
      <div>
        <PageTitle>Roadmap</PageTitle>
        <p className="opacity-50">No `ROADMAP.md` found at the project root.</p>
      </div>
    );
  }

  const graduatedByItem = (item: ResolvedRoadmapItem) =>
    plans?.entries.filter((p) => p.subject === item.name) ?? [];

  const handleAddItem = async (horizonTitle: string, name: string, description: string) => {
    await addRoadmapItem(horizonTitle, name, description);
    setRoadmap(await fetchRoadmap());
  };

  const handleAddCandidate = async (horizonTitle: string, itemName: string, name: string) => {
    await addRoadmapCandidate(horizonTitle, itemName, name);
    setRoadmap(await fetchRoadmap());
  };

  return (
    <div ref={containerRef}>
      <GoalBanner goal={roadmap.goal} />
      <div className="flex flex-col gap-6">
        {roadmap.horizons.map((horizon) => (
          <div key={horizon.title} className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <div className={HORIZON_HEADER_CLASSES}>{horizon.title}</div>
              <HorizonPulse items={horizon.items} graduatedByItem={graduatedByItem} />
            </div>
            <div className="flex flex-col gap-1">
              {horizon.items.map((item) => (
                <RoadmapItemRow
                  key={item.name}
                  item={item}
                  graduated={graduatedByItem(item)}
                  highlighted={item.name === highlightedItem}
                  onPromote={() => setPromoting({ horizonTitle: horizon.title, item })}
                  onPromoteCandidate={(candidateName) =>
                    setPromoting({ horizonTitle: horizon.title, item, candidateName })
                  }
                  onAddCandidate={(name) => handleAddCandidate(horizon.title, item.name, name)}
                  onOpenGraduated={(title) =>
                    navigate({
                      to: '/plans/$planId',
                      params: { planId: encodeURIComponent(title) },
                    })
                  }
                />
              ))}
              <AddItemForm
                onAdd={(name, description) => handleAddItem(horizon.title, name, description)}
              />
            </div>
          </div>
        ))}
      </div>
      <PromoteRoadmapItemModal
        horizonTitle={promoting?.horizonTitle ?? null}
        item={promoting?.item ?? null}
        candidateName={promoting?.candidateName}
        onClose={() => setPromoting(null)}
        onPromoted={() => fetchRoadmap().then(setRoadmap)}
      />
    </div>
  );
};
