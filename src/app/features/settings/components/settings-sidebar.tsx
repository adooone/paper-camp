import { useAppStore } from '@/app/stores/app-store';
import { ListItem } from '@dendelion/paper-ui';
import { SidebarSection } from '../../plans/components/sidebar-section';

export const SettingsSidebar = () => {
  const activeSection = useAppStore((s) => s.activeSettingsSection);
  const setActiveSection = useAppStore((s) => s.setActiveSettingsSection);

  return (
    <SidebarSection label="General">
      <ListItem
        size="small"
        active={activeSection === 'general'}
        onClick={() => setActiveSection('general')}
      >
        Project Info
      </ListItem>
    </SidebarSection>
  );
};
