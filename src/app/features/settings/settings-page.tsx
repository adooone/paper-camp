import { PageTitle } from '@/app/components/page-title';
import { useActiveSettingsSection } from '@/app/hooks';
import { MergePolicySection } from './components/merge-policy-section';
import { SetupSection } from './components/setup-section';
import { SubjectsSection } from './components/subjects-section';
import { GeneralSection } from './views';

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
      ) : (
        <GeneralSection />
      )}
    </div>
  );
};
