import { Button, Card } from '@dendelion/paper-ui';

interface CandidateRowProps {
  name: string;
  onPromote: () => void;
}

export const CandidateRow = ({ name, onPromote }: CandidateRowProps) => (
  <Card size="small" texture="kraft" className="plan-row-card">
    <div className="flex items-center gap-3">
      <span className="flex-1">{name}</span>
      <Button type="button" variant="ghost" size="small" onClick={onPromote}>
        Promote to idea
      </Button>
    </div>
  </Card>
);
