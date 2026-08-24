import { splitPathForDisplay } from '@/app/utils/path-display';

interface FilePathProps {
  path: string;
  prefix?: string;
  className?: string;
}

export const FilePath = ({ path, prefix, className = '' }: FilePathProps) => {
  const { dir, base } = splitPathForDisplay(path);
  const dimmed = `${prefix ?? ''}${dir}`;
  return (
    <span className={`flex min-w-0 items-center font-mono ${className}`}>
      {dimmed && (
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap opacity-50">
          {dimmed}
        </span>
      )}
      <span className="shrink-0 whitespace-nowrap">{base}</span>
    </span>
  );
};
