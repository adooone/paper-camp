import { Stamp } from '@dendelion/paper-ui';
import { colors } from '@dendelion/paper-ui/tokens';

interface PlanIdStampProps {
  id?: string;
}

export const PlanIdStamp = ({ id }: PlanIdStampProps) => {
  if (!id) return null;
  return (
    <Stamp size="small" fillColor={colors.borderSubtle}>
      {id}
    </Stamp>
  );
};
