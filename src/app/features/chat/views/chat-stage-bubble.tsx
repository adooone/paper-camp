import { Avatar, Card } from '@dendelion/folk-ui';
import type { ChatStageInfo } from '../hooks/use-chat-stage';
import { chatStageLine, showsSlowCliHint } from '../hooks/use-chat-stage';

const metaLineClass = 'flex items-center gap-2 text-sm font-semibold opacity-[0.45]';
const DOT_DELAYS_MS = [0, 150, 300];

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
              <div className="flex items-center gap-1">
                {DOT_DELAYS_MS.map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-desk-chalk motion-reduce:animate-none"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
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
