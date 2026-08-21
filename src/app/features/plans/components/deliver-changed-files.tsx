import { useNavigate } from '@tanstack/react-router';

interface DeliverChangedFilesProps {
  count: number;
}

export const DeliverChangedFiles = ({ count }: DeliverChangedFilesProps) => {
  const navigate = useNavigate();
  return (
    // Raw <button>: paper-ui Button has no inline-underlined link style.
    <button
      type="button"
      onClick={() => navigate({ to: '/git' })}
      className="bg-none bg-transparent border-none p-0 font-handwritten text-xs opacity-[0.6] underline cursor-pointer"
    >
      {count} file{count === 1 ? '' : 's'} changed
    </button>
  );
};
