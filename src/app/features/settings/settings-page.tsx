import { PageTitle } from '@/app/components/page-title';
import { useActiveSettingsSection } from '@/app/hooks';
import { MergePolicySection } from './components/merge-policy-section';
import { SetupSection } from './components/setup-section';
import { SubjectsSection } from './components/subjects-section';
import { ToolbarSection } from './components/toolbar-section';
import { DeskSection, GeneralSection, NightSection } from './views';

export const SettingsPage = () => {
  const section = useActiveSettingsSection();
  return (
    <div>
      <PageTitle>Settings</PageTitle>
      {section === 'subjects' ? (
        <SubjectsSection />
      ) : section === 'setup' ? (
        <SetupSection />
      ) : section === 'merge-policy' ? (
        <MergePolicySection />
      ) : section === 'desk' ? (
        <DeskSection />
      ) : section === 'toolbar' ? (
        <ToolbarSection />
      ) : section === 'night' ? (
        <NightSection />
      ) : (
        <GeneralSection />
      )}
    </div>
  );
};
