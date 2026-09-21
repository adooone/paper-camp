import { Button } from '@dendelion/paper-ui';

interface CandidateRowProps {
  name: string;
  onPromote: () => void;
}

export const CandidateRow = ({ name, onPromote }: CandidateRowProps) => (
  <div className="flex items-center gap-3 border-b border-black/10 py-1.5 last:border-b-0">
    <span className="flex-1">{name}</span>
    <Button type="button" variant="ghost" size="small" onClick={onPromote}>
      Promote
    </Button>
  </div>
);
