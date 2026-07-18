import { ListItem } from '@dendelion/paper-ui';
import { SidebarSection } from '../../plans/components/sidebar-section';

export const SettingsSidebar = () => (
  <SidebarSection label="General">
    <ListItem size="small" active>
      Project Info
    </ListItem>
  </SidebarSection>
);
