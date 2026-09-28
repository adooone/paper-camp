import { Stamp } from '@dendelion/paper-ui';
import { colors } from '@dendelion/paper-ui/tokens';

interface PlanIdStampProps {
  id?: string;
  /** Fill the row's id cell, as the stamp did when it was the grid item itself. */
  fill?: boolean;
}

export const PlanIdStamp = ({ id, fill = false }: PlanIdStampProps) => {
  if (!id) return null;
  return (
    <Stamp size="small" fillColor={colors.borderSubtle} className={fill ? 'w-full' : undefined}>
      {id}
    </Stamp>
  );
};
