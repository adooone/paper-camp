import { AddToBacklogButton, NewIdeaButton, WorklistActionsMenu } from '../actions';

export const PlansHeader = () => {
  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <h1 className="text-4xl flex-1 font-display-luminari font-semibold text-ink-900 m-0 leading-[1.1]">
        Plans
      </h1>

      <NewIdeaButton />
      <AddToBacklogButton />
      <WorklistActionsMenu />
    </div>
  );
};
