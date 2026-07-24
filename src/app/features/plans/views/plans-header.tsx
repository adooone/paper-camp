import { color, fontFamily, space } from '@/app/styles/tokens';
import { AddToBacklogButton, NewIdeaButton, RefreshButton, WorklistActionsMenu } from '../actions';

export const PlansHeader = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        marginBottom: space[6],
        flexWrap: 'wrap',
      }}
    >
      <h1
        className="text-4xl"
        style={{
          flex: 1,
          fontFamily: fontFamily.serif,
          fontWeight: 600,
          color: color.textPrimary,
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        Ideas
      </h1>

      <RefreshButton />
      <NewIdeaButton />
      <AddToBacklogButton />
      <WorklistActionsMenu />
    </div>
  );
};
