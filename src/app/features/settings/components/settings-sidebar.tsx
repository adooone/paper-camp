import { useActiveSettingsSection } from '@/app/hooks';
import { SidebarCard, SidebarItem, SidebarLabel } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

export const SettingsSidebar = () => {
  const section = useActiveSettingsSection();
  const navigate = useNavigate();

  return (
    <SidebarCard className="shrink-0">
      <SidebarLabel>General</SidebarLabel>
      <div className="flex flex-col">
        <SidebarItem active={section === null} onClick={() => navigate({ to: '/settings' })}>
          Project Info
        </SidebarItem>
        <SidebarItem
          active={section === 'setup'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'setup' } })}
        >
          Setup
        </SidebarItem>
        <SidebarItem
          active={section === 'merge-policy'}
          onClick={() =>
            navigate({ to: '/settings/$section', params: { section: 'merge-policy' } })
          }
        >
          Merge Policy
        </SidebarItem>
        <SidebarItem
          active={section === 'toolbar'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'toolbar' } })}
        >
          Toolbar
        </SidebarItem>
      </div>
      <SidebarLabel>Stack</SidebarLabel>
      <div className="flex flex-col">
        <SidebarItem
          active={section === 'desk'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'desk' } })}
        >
          Desk
        </SidebarItem>
      </div>
      <SidebarLabel>Automation</SidebarLabel>
      <div className="flex flex-col">
        <SidebarItem
          active={section === 'night'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'night' } })}
        >
          Review passes
        </SidebarItem>
      </div>
      <SidebarLabel>Notifications</SidebarLabel>
      <div className="flex flex-col">
        <SidebarItem
          active={section === 'notifications'}
          onClick={() =>
            navigate({ to: '/settings/$section', params: { section: 'notifications' } })
          }
        >
          Notifications
        </SidebarItem>
      </div>
    </SidebarCard>
  );
};
