import { useProjectIdentity } from '@/app/hooks';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import { FolderIcon, Icon } from '@dendelion/paper-ui';

interface ProjectIdentityHeaderProps {
  size?: 'sm' | 'md';
}

export const ProjectIdentityHeader = ({ size = 'md' }: ProjectIdentityHeaderProps) => {
  const { projectName, iconDataUri, loading } = useProjectIdentity();
  const iconSize = size === 'sm' ? 18 : 20;
  const textSize = size === 'sm' ? fontSize.sm : fontSize.md;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[3], minWidth: 0 }}>
      {iconDataUri ? (
        <img
          src={iconDataUri}
          alt=""
          style={{ width: iconSize, height: iconSize, objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <Icon icon={<FolderIcon />} size="small" />
      )}
      <span
        style={{
          fontFamily: fontFamily.serif,
          fontWeight: 600,
          fontSize: textSize,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
      >
        {loading ? 'Loading…' : (projectName ?? 'Paper Camp')}
      </span>
    </div>
  );
};
