import { EmptyState } from '../ui/empty-state';
import { Paper } from '../ui/paper';

export const NotFoundPage = () => (
  <Paper>
    <EmptyState title="Nothing here" line="That address is not on this desk." />
  </Paper>
);
