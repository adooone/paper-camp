import { Avatar, Card, Spinner } from '@dendelion/folk-ui';
import type { ChatStageInfo } from '../hooks/use-chat-stage';
import { chatStageLine, showsSlowCliHint } from '../hooks/use-chat-stage';

const metaLineClass = 'flex items-center gap-2 text-sm font-semibold opacity-[0.45]';

export const ChatStageBubble = ({ stage }: { stage: ChatStageInfo }) => (
  <div className="flex flex-col gap-1 items-start mb-3">
    <div className="max-w-[85%] flex items-start gap-2">
      <Avatar name="Scout" size="small" />
      <div className="flex flex-col gap-1 min-w-0">
        <div className={metaLineClass}>
          <span>Scout</span>
        </div>
        <Card size="small" surface="paper" texture="kraft" shade>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Spinner size="small" label={chatStageLine(stage)} />
              <span>{chatStageLine(stage)}</span>
            </div>
            {showsSlowCliHint(stage) && (
              <span className="text-sm opacity-[0.45]">
                The agent CLI can take a minute to start.
              </span>
            )}
          </div>
        </Card>
      </div>
    </div>
  </div>
);
