import { useActiveSettingsSection } from '@/app/hooks';
import { ListItem } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { SidebarSection } from '../../plans/components/sidebar-section';

export const SettingsSidebar = () => {
  const section = useActiveSettingsSection();
  const navigate = useNavigate();

  return (
    <>
      <SidebarSection label="General">
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
      </SidebarSection>
      <SidebarSection label="Ideas">
        <ListItem
          size="small"
          className="pc-row text-xs"
          active={section === 'subjects'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'subjects' } })}
        >
          Subjects
        </ListItem>
      </SidebarSection>
      <SidebarSection label="Stack">
        <ListItem
          size="small"
          className="pc-row text-xs"
          active={section === 'desk'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'desk' } })}
        >
          Desk
        </ListItem>
      </SidebarSection>
    </>
  );
};
