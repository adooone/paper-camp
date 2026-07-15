import { color, fontFamily, space } from '@/app/styles/tokens';
import {
  ActualiseAllButton,
  AddToBacklogButton,
  NewIdeaButton,
  RefreshButton,
  SuggestIdeasButton,
} from '../actions';

export const PlansHeader = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        marginBottom: space[6],
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
        Plans
      </h1>

      <RefreshButton />
      <NewIdeaButton />
      <AddToBacklogButton />
      <SuggestIdeasButton />
      <ActualiseAllButton />
    </div>
  );
};
