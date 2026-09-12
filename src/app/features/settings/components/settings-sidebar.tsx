import { SidebarCard } from '@/app/components/sidebar';
import { SidebarLabel } from '@/app/components/sidebar';
import { useActiveSettingsSection } from '@/app/hooks';
import { ListItem } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

export const SettingsSidebar = () => {
  const section = useActiveSettingsSection();
  const navigate = useNavigate();

  return (
    <SidebarCard>
      <SidebarLabel>General</SidebarLabel>
      <div className="flex flex-col">
        <ListItem
          size="small"
          className="pc-row text-xs"
          active={section === null}
          onClick={() => navigate({ to: '/settings' })}
        >
          Project Info
        </ListItem>
        <ListItem
          size="small"
          className="pc-row text-xs"
          active={section === 'setup'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'setup' } })}
        >
          Setup
        </ListItem>
        <ListItem
          size="small"
          className="pc-row text-xs"
          active={section === 'merge-policy'}
          onClick={() =>
            navigate({ to: '/settings/$section', params: { section: 'merge-policy' } })
          }
        >
          Merge Policy
        </ListItem>
        <ListItem
          size="small"
          className="pc-row text-xs"
          active={section === 'toolbar'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'toolbar' } })}
        >
          Toolbar
        </ListItem>
      </div>
      <SidebarLabel>Ideas</SidebarLabel>
      <div className="flex flex-col">
        <ListItem
          size="small"
          className="pc-row text-xs"
          active={section === 'subjects'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'subjects' } })}
        >
          Subjects
        </ListItem>
      </div>
      <SidebarLabel>Stack</SidebarLabel>
      <div className="flex flex-col">
        <ListItem
          size="small"
          className="pc-row text-xs"
          active={section === 'desk'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'desk' } })}
        >
          Desk
        </ListItem>
      </div>
      <SidebarLabel>Automation</SidebarLabel>
      <div className="flex flex-col">
        <ListItem
          size="small"
          className="pc-row text-xs"
          active={section === 'night'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'night' } })}
        >
          Night shift
        </ListItem>
      </div>
    </SidebarCard>
  );
};
