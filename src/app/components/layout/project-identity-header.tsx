import { useProjectIdentity } from '@/app/hooks';
import { FolderIcon, Icon } from '@dendelion/paper-ui';

interface ProjectIdentityHeaderProps {
  size?: 'sm' | 'md';
}

export const ProjectIdentityHeader = ({ size = 'md' }: ProjectIdentityHeaderProps) => {
  const { projectName, iconDataUri, loading } = useProjectIdentity();

  return (
    <div className="flex items-center gap-3 min-w-0">
      {iconDataUri ? (
        <img
          src={iconDataUri}
          alt=""
          className={`object-contain shrink-0 ${size === 'sm' ? 'w-[18px] h-[18px]' : 'w-[20px] h-[20px]'}`}
        />
      ) : (
        <Icon icon={<FolderIcon />} size="small" />
      )}
      <span
        className={`font-display-luminari font-semibold whitespace-nowrap overflow-hidden text-ellipsis min-w-0 ${
          size === 'sm' ? 'text-sm' : 'text-md'
        }`}
      >
        {loading ? 'Loading…' : (projectName ?? 'Paper Camp')}
      </span>
    </div>
  );
};
