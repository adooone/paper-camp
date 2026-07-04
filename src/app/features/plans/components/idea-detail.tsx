import { Markdown } from '@/app/components/markdown';
import { useActionFeedback } from '@/app/hooks/use-action-feedback';
import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
import type { IdeaEntry } from '@/types/index';
import { Button, Stamp, Tooltip, useToast } from '@dendelion/paper-ui';
import { buildIdeaExtendPrompt } from '../prompts';

interface IdeaDetailProps {
  idea: IdeaEntry;
}

export const IdeaDetail = ({ idea }: IdeaDetailProps) => {
  return (
    <div
      style={{
        fontFamily: fontFamily.body,
        fontSize: fontSize.base,
        lineHeight: lineHeight.relaxed,
        color: '#1C1B18',
      }}
    >
      <h2
        style={{
          fontFamily: fontFamily.serif,
          fontWeight: 600,
          fontSize: '1.75rem',
          margin: `0 0 ${space[4]}`,
          lineHeight: lineHeight.tight,
          display: 'flex',
          alignItems: 'center',
          gap: space[3],
        }}
      >
        {idea.id && (
          <Stamp size="small" fillColor="rgba(0,0,0,0.08)">
            {idea.id}
          </Stamp>
        )}
        {idea.title}
      </h2>
      <Markdown>
        {idea.body
          .replace(/^#{1,3}\s+.+(\n|$)/, '')
          .replace(/^-{3,}\s*$/m, '')
          .trim()}
      </Markdown>
      <div style={{ marginTop: space[6] }}>
        <ExtendWithAIButton ideaId={idea.id} />
      </div>
    </div>
  );
};

const ExtendWithAIButton = ({ ideaId }: { ideaId: string | null }) => {
  const launchIdeaExtend = useAppStore((s) => s.launchIdeaExtend);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const agentBusy =
    agentStatus !== null && agentStatus.status !== 'done' && agentStatus.status !== 'error';
  const { state, errorMessage, run } = useActionFeedback();
  const { toast } = useToast();

  const handleClick = () => {
    if (!ideaId) return;
    run(async () => {
      const idea = useAppStore.getState().ideaEntries.find((e) => e.id === ideaId);
      if (!idea) return;
      try {
        await launchIdeaExtend(ideaId, buildIdeaExtendPrompt(idea));
      } catch (err) {
        toast({
          title: 'Extension failed',
          description: (err as Error).message,
          variant: 'error',
        });
        throw err;
      }
    });
  };

  const title =
    state === 'error'
      ? (errorMessage ?? 'Extension failed')
      : ideaId
        ? undefined
        : 'Idea needs an ID before an agent can run';

  return (
    <Tooltip content={title}>
      <Button
        variant="ghost"
        size="small"
        onClick={handleClick}
        disabled={agentBusy || state === 'loading' || !ideaId}
      >
        {state === 'loading'
          ? 'Extending…'
          : state === 'success'
            ? 'Extension sent!'
            : state === 'error'
              ? 'Extension failed'
              : 'Extend with AI'}
      </Button>
    </Tooltip>
  );
};
