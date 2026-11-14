import { Avatar, Card, Spinner } from '@dendelion/folk-ui';
import type { ChatTurnInfo } from '../hooks/use-chat-stage';
import { chatStageLine, showsSlowCliHint } from '../hooks/use-chat-stage';
import { EntityLinkText } from './entity-link-text';

const metaLineClass = 'flex items-center gap-2 text-sm font-semibold opacity-[0.45]';

const VISIBLE_TOOL_LINES = 4;

export const ChatStageBubble = ({ turn }: { turn: ChatTurnInfo }) => {
  const tools = turn.tools.slice(-VISIBLE_TOOL_LINES);
  const stageLine = turn.stage ? chatStageLine(turn.stage, turn.elapsedSeconds) : null;

  return (
    <div className="flex flex-col gap-1 items-start mb-3">
      <div className="max-w-[85%] flex items-start gap-2">
        <Avatar name="Scout" size="small" />
        <div className="flex flex-col gap-1 min-w-0">
          <div className={metaLineClass}>
            <span>Scout</span>
          </div>
          {tools.length > 0 && (
            <div className="flex flex-col gap-0.5 text-sm opacity-[0.55]">
              {tools.map((tool, i) => (
                <span key={`${turn.tools.length - tools.length + i}`} className="truncate">
                  {tool}
                </span>
              ))}
            </div>
          )}
          <Card size="small" surface="paper" texture="kraft" shade>
            <div className="flex flex-col gap-1">
              {turn.text && <EntityLinkText text={turn.text} />}
              {stageLine && (
                <div className="flex items-center gap-2">
                  <Spinner size="small" label={stageLine} />
                  {!turn.text && <span>{stageLine}</span>}
                </div>
              )}
              {showsSlowCliHint(turn) && !turn.text && (
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
};
