import { Markdown } from '@/app/components/markdown';
import type { IdeaEntry } from '@/types/index';
import { Button, Stamp } from '@dendelion/paper-ui';
import { ExtendIdeaButton } from '../actions';
import { PlanIdStamp } from '../components';
import { IDEA_STATUS_LABEL, IDEA_STATUS_STAMP } from '../constants';
import { usePlanStatusPatch } from '../hooks';

interface NoteDetailProps {
  idea: IdeaEntry;
}

export const NoteDetail = ({ idea }: NoteDetailProps) => {
  const { patch, updating } = usePlanStatusPatch();
  const closed = idea.status === 'done' || idea.status === 'dropped';
  return (
    <div className="text-base leading-[1.7] text-ink-900">
      <h2 className="font-display-luminari font-semibold text-[1.75rem] leading-tight mt-0 mr-0 mb-4 ml-0 flex items-center gap-3 flex-wrap">
        <PlanIdStamp id={idea.id ?? undefined} />
        {idea.title}
        {idea.status && (
          <Stamp
            size="small"
            fillColor={IDEA_STATUS_STAMP[idea.status].fill}
            textColor={IDEA_STATUS_STAMP[idea.status].text}
          >
            {IDEA_STATUS_LABEL[idea.status]}
          </Stamp>
        )}
      </h2>
      <Markdown>
        {idea.body
          .replace(/^#{1,3}\s+.+(\n|$)/, '')
          // Only a leading delimiter, not the `m` flag — otherwise this strips any
          // standalone `---` horizontal rule the user wrote mid-body.
          .replace(/^\s*-{3,}\s*(\n|$)/, '')
          .trim()}
      </Markdown>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {closed ? (
          <Button
            type="button"
            variant="ghost"
            size="small"
            disabled={updating}
            onClick={() => patch(idea.title, { status: null })}
          >
            Reopen
          </Button>
        ) : (
          <>
            <ExtendIdeaButton idea={idea} />
            <Button
              type="button"
              variant="secondary"
              size="small"
              disabled={updating}
              onClick={() => patch(idea.title, { status: 'done' })}
            >
              Done
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="small"
              disabled={updating}
              onClick={() => patch(idea.title, { status: 'dropped' })}
            >
              Drop
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
