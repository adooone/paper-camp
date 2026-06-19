import { Card, Icon, LightbulbIcon } from '@dendelion/paper-ui';

interface IdeaCardProps {
  title: string;
  onClick?: () => void;
}

export const IdeaCard = ({ title, onClick }: IdeaCardProps) => {
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick();
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ cursor: onClick ? 'pointer' : undefined, height: '100%' }}
    >
      <Card texture="white" size="small" className="h-full">
        <div className="flex items-center gap-2">
          <Icon icon={<LightbulbIcon />} size="small" />
          <span
            style={{
              fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: '#1C1B18',
            }}
          >
            {title}
          </span>
        </div>
      </Card>
    </div>
  );
};
