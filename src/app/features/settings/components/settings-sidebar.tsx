import { fetchConfigs } from '@/app/services/config-files-api';
import { fetchEnv } from '@/app/services/env-api';
import { useAppStore } from '@/app/stores/app-store';
import { ListItem } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { SidebarSection } from '../../plans/components/sidebar-section';

export const SettingsSidebar = () => {
  const activeSection = useAppStore((s) => s.activeSettingsSection);
  const setActiveSection = useAppStore((s) => s.setActiveSettingsSection);
  const configFiles = useAppStore((s) => s.settingsConfigFiles);
  const setConfigFiles = useAppStore((s) => s.setSettingsConfigFiles);
  const [showEnv, setShowEnv] = useState(false);

  useEffect(() => {
    fetchConfigs().then(setConfigFiles);
    fetchEnv().then((env) => setShowEnv(env.exists || env.exampleExists));
  }, [setConfigFiles]);

  return (
    <>
      <SidebarSection label="General">
        <ListItem
          size="small"
          active={activeSection === 'general'}
          onClick={() => setActiveSection('general')}
        >
          Project Info
        </ListItem>
      </SidebarSection>

      {showEnv && (
        <SidebarSection label="Environment">
          <ListItem
            size="small"
            active={activeSection === 'env'}
            onClick={() => setActiveSection('env')}
          >
            Env Vars
          </ListItem>
        </SidebarSection>
      )}

      {configFiles.length > 0 && (
        <SidebarSection label="Config Files">
          {configFiles.map((name) => (
            <ListItem
              key={name}
              size="small"
              active={activeSection === `config:${name}`}
              onClick={() => setActiveSection(`config:${name}`)}
            >
              {name}
            </ListItem>
          ))}
        </SidebarSection>
      )}
    </>
  );
};
