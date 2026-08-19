import { NewIdeaButton, WorklistActionsMenu } from '../actions';
import { GroupBySubjectToggle } from './worklist-rows';

interface PlansHeaderProps {
  showGroupingToggle?: boolean;
}

export const PlansHeader = ({ showGroupingToggle = false }: PlansHeaderProps) => {
  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <h1 className="text-4xl flex-1 font-display-luminari font-semibold text-ink-900 m-0 leading-[1.1]">
        Plans
      </h1>

      {showGroupingToggle && <GroupBySubjectToggle />}
      <NewIdeaButton />
      <WorklistActionsMenu />
    </div>
  );
};
