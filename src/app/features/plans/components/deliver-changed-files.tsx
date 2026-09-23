import { Button } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

interface DeliverChangedFilesProps {
  count: number;
}

export const DeliverChangedFiles = ({ count }: DeliverChangedFilesProps) => {
  const navigate = useNavigate();
  return (
    <Button
      variant="link"
      onClick={() => navigate({ to: '/git' })}
      className="font-handwritten text-xs opacity-[0.6]"
    >
      {count} file{count === 1 ? '' : 's'} changed
    </Button>
  );
};
