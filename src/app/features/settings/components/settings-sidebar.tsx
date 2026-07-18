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
          active={section === null}
          onClick={() => navigate({ to: '/settings' })}
        >
          Project Info
        </ListItem>
      </SidebarSection>
      <SidebarSection label="Ideas">
        <ListItem
          size="small"
          active={section === 'subjects'}
          onClick={() => navigate({ to: '/settings/$section', params: { section: 'subjects' } })}
        >
          Subjects
        </ListItem>
      </SidebarSection>
    </>
  );
};
