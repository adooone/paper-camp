import { Markdown } from '@/app/components/markdown';
import { PageTitle } from '@/app/components/page-title';
import { PrBadge } from '@/app/features/plans/components/pr-badge';
import { STATUS_LABEL, STATUS_STAMP } from '@/app/features/plans/constants';
import { addRoadmapCandidate, addRoadmapItem, fetchRoadmap } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import type {
  PlanEntry,
  ResolvedRoadmap,
  ResolvedRoadmapItem,
  RoadmapEvent,
  RoadmapEventKind,
  RoadmapLink,
} from '@/types/index';
import { Button, Card, Input, Stamp, Tooltip } from '@dendelion/paper-ui';
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

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const RoadmapLinkTrail = ({ link }: { link: RoadmapLink }) => (
  <div className="flex items-center gap-1">
    <Tooltip content={`${plural(link.taskRuns, 'task run')}${link.released ? ' · released' : ''}`}>
      <Stamp
        size="small"
        fillColor={STATUS_STAMP[link.status].fill}
        textColor={STATUS_STAMP[link.status].text}
      >
        {link.id}
      </Stamp>
    </Tooltip>
    {link.pr && <PrBadge pr={link.pr} />}
  </div>
);

const GraduatedRow = ({ plan, onOpen }: { plan: PlanEntry; onOpen: () => void }) => (
  <Card size="small" texture="kraft" className="plan-row-card">
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3 w-full bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left"
    >
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{plan.title}</span>
      <Stamp
        size="small"
        fillColor={STATUS_STAMP[plan.status].fill}
        textColor={STATUS_STAMP[plan.status].text}
      >
        {STATUS_LABEL[plan.status]}
      </Stamp>
    </button>
  </Card>
);

const RoadmapItemRow = ({
  item,
  graduated,
  highlighted,
  onPromote,
  onPromoteCandidate,
  onAddCandidate,
  onViewGraduated,
  onOpenGraduated,
}: {
  item: ResolvedRoadmapItem;
  graduated: PlanEntry[];
  highlighted: boolean;
  onPromote: () => void;
  onPromoteCandidate: (candidateName: string) => void;
  onAddCandidate: (name: string) => Promise<void>;
  onViewGraduated: () => void;
  onOpenGraduated: (title: string) => void;
}) => {
  const [expanded, setExpanded] = useState(highlighted);
  const hasCandidates = item.candidates.length > 0;
  const { shipped, queued } = graduationCounts(graduated);

  return (
    <div
      className={`flex flex-col gap-1 ${highlighted ? 'roadmap-item-highlighted outline outline-2 outline-offset-[-2px] outline-[rgba(200,154,90,0.5)]' : ''}`}
    >
      <Card size="small" texture="canvas" className="plan-row-card">
        <div className="flex flex-col gap-1">
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
            <span className="font-semibold flex-1">{item.name}</span>
            <Button type="button" variant="ghost" size="small" onClick={onPromote}>
              Promote to idea
            </Button>
          </div>
          <span className={`text-sm opacity-70 ${expanded ? '' : 'line-clamp-2'}`}>
            {item.description}
          </span>
          <div className="flex items-center gap-1">
            {(queued > 0 || shipped > 0) && (
              <button
                type="button"
                onClick={onViewGraduated}
                className="flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer"
              >
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
              </button>
            )}
            {hasCandidates && (
              <Stamp size="small" fillColor="rgba(0, 0, 0, 0.06)" textColor="rgba(0, 0, 0, 0.55)">
                {item.candidates.length} candidate{item.candidates.length === 1 ? '' : 's'}
              </Stamp>
            )}
            {item.rollup.total > 0 && (
              <Stamp
                size="small"
                fillColor={STATUS_STAMP.planned.fill}
                textColor={STATUS_STAMP.planned.text}
              >
                {item.rollup.done}/{item.rollup.total} done
              </Stamp>
            )}
          </div>
          {item.links.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {item.links.map((link) => (
                <RoadmapLinkTrail key={link.id} link={link} />
              ))}
            </div>
          )}
        </div>
      </Card>
      {expanded && (
        <div className="flex flex-col gap-1 pl-6">
          {item.candidates.map((candidateName) => (
            <CandidateRow
              key={candidateName}
              name={candidateName}
              onPromote={() => onPromoteCandidate(candidateName)}
            />
          ))}
          {graduated.map((plan) => (
            <GraduatedRow key={plan.title} plan={plan} onOpen={() => onOpenGraduated(plan.title)} />
          ))}
          <AddCandidateForm onAdd={onAddCandidate} />
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

type RoadmapViewMode = 'tree' | 'map' | 'timeline';

const VIEW_MODES: { id: RoadmapViewMode; label: string }[] = [
  { id: 'tree', label: 'Outline' },
  { id: 'map', label: 'Board' },
  { id: 'timeline', label: 'Timeline' },
];

const RoadmapViewModeSwitch = ({
  mode,
  onChange,
}: {
  mode: RoadmapViewMode;
  onChange: (mode: RoadmapViewMode) => void;
}) => (
  <nav aria-label="Roadmap view" className="flex gap-1 mb-4">
    {VIEW_MODES.map((viewMode) => (
      <Button
        key={viewMode.id}
        type="button"
        variant="ghost"
        size="small"
        isActive={mode === viewMode.id}
        aria-pressed={mode === viewMode.id}
        onClick={() => onChange(viewMode.id)}
      >
        {viewMode.label}
      </Button>
    ))}
  </nav>
);

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

const EVENT_KIND_COLOR: Record<RoadmapEventKind, string> = {
  created: 'bg-watercolor-slate',
  'task-run': 'bg-watercolor-amber',
};

const RoadmapTimelineTrack = ({
  events,
  rangeStart,
  rangeEnd,
}: {
  events: RoadmapEvent[];
  rangeStart: number;
  rangeEnd: number;
}) => {
  const span = rangeEnd - rangeStart || 1;
  return (
    <div className="relative h-8 mx-1 border-b border-black/10">
      {events.map((event, i) => (
        <button
          type="button"
          key={`${event.entityId}-${event.kind}-${i}`}
          className={`absolute top-1/2 w-2.5 h-2.5 p-0 border-none rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer ${EVENT_KIND_COLOR[event.kind]}`}
          style={{
            left: `${((Date.parse(event.date) - rangeStart) / span) * 100}%`,
          }}
          title={`${event.itemName} — ${event.label} (${event.date})`}
          aria-label={`${event.itemName} — ${event.label} (${event.date})`}
        />
      ))}
    </div>
  );
};

const RoadmapMapItem = ({ item }: { item: ResolvedRoadmapItem }) => {
  const percent =
    item.rollup.total > 0 ? Math.round((item.rollup.done / item.rollup.total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1 py-2 px-2.5">
      <div className="font-semibold text-sm">{item.name}</div>
      <div className="h-1.5 rounded-full bg-black/[0.08] overflow-hidden">
        <div
          className={`h-full rounded-full ${item.rollup.total > 0 ? 'bg-watercolor-green' : 'bg-transparent'}`}
          style={{
            width: `${percent}%`,
          }}
        />
      </div>
      <div className="text-2xs opacity-50">
        {item.rollup.total > 0 ? `${item.rollup.done}/${item.rollup.total} done` : 'not started'}
      </div>
    </div>
  );
};

const RoadmapMap = ({
  roadmap,
  graduatedByItem,
}: {
  roadmap: ResolvedRoadmap;
  graduatedByItem: (item: ResolvedRoadmapItem) => PlanEntry[];
}) => (
  <div className="flex flex-col gap-6">
    {roadmap.horizons.map((horizon) => (
      <div key={horizon.title} className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <div className={HORIZON_HEADER_CLASSES}>{horizon.title}</div>
          <HorizonPulse items={horizon.items} graduatedByItem={graduatedByItem} />
        </div>
        <div className="flex flex-wrap items-start gap-2.5">
          {horizon.items.map((item) => (
            <div
              key={item.name}
              className="flex-[1_1_240px] max-w-[320px] max-[480px]:flex-[1_1_100%] max-[480px]:max-w-none"
            >
              <RoadmapMapItem item={item} />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const RoadmapTimeline = ({ roadmap }: { roadmap: ResolvedRoadmap }) => {
  if (roadmap.events.length === 0) {
    return <p className="opacity-50">No dated events yet.</p>;
  }

  const dates = roadmap.events.map((event) => Date.parse(event.date));
  const rangeStart = Math.min(...dates);
  const rangeEnd = Math.max(...dates);

  return (
    <div className="flex flex-col gap-6">
      {roadmap.horizons.map((horizon) => {
        const events = roadmap.events.filter((event) => event.horizonTitle === horizon.title);
        return (
          <div key={horizon.title} className="flex flex-col gap-1">
            <div className={HORIZON_HEADER_CLASSES}>{horizon.title}</div>
            {events.length === 0 ? (
              <div className="text-2xs font-normal px-1 py-0 opacity-40">No events yet</div>
            ) : (
              <RoadmapTimelineTrack events={events} rangeStart={rangeStart} rangeEnd={rangeEnd} />
            )}
          </div>
        );
      })}
      <div className="flex justify-between text-2xs opacity-50">
        <span>{new Date(rangeStart).toLocaleDateString()}</span>
        <span>{new Date(rangeEnd).toLocaleDateString()}</span>
      </div>
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
  const [viewMode, setViewMode] = useState<RoadmapViewMode>('tree');
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
      <RoadmapViewModeSwitch mode={viewMode} onChange={setViewMode} />
      {viewMode === 'tree' && (
        <div className="flex flex-col gap-6">
          {roadmap.horizons.map((horizon) => (
            <div key={horizon.title} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <div className={HORIZON_HEADER_CLASSES}>{horizon.title}</div>
                <HorizonPulse items={horizon.items} graduatedByItem={graduatedByItem} />
              </div>
              <div className="flex flex-wrap items-start gap-2.5">
                {horizon.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex-[1_1_240px] max-w-[320px] max-[480px]:flex-[1_1_100%] max-[480px]:max-w-none"
                  >
                    <RoadmapItemRow
                      item={item}
                      graduated={graduatedByItem(item)}
                      highlighted={item.name === highlightedItem}
                      onPromote={() => setPromoting({ horizonTitle: horizon.title, item })}
                      onPromoteCandidate={(candidateName) =>
                        setPromoting({ horizonTitle: horizon.title, item, candidateName })
                      }
                      onAddCandidate={(name) => handleAddCandidate(horizon.title, item.name, name)}
                      onViewGraduated={() => navigate({ to: '/', search: { subject: item.name } })}
                      onOpenGraduated={(title) =>
                        navigate({
                          to: '/plans/$planId',
                          params: { planId: encodeURIComponent(title) },
                        })
                      }
                    />
                  </div>
                ))}
                <div className="flex-[1_1_240px] max-w-[320px] max-[480px]:flex-[1_1_100%] max-[480px]:max-w-none">
                  <AddItemForm
                    onAdd={(name, description) => handleAddItem(horizon.title, name, description)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {viewMode === 'map' && <RoadmapMap roadmap={roadmap} graduatedByItem={graduatedByItem} />}
      {viewMode === 'timeline' && <RoadmapTimeline roadmap={roadmap} />}
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
