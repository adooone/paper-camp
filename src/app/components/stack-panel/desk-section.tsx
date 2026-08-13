import { useDeskManifest } from '@/app/hooks/use-desk-manifest';
import { Divider } from '@dendelion/paper-ui';
import { BuildGroup } from './build-group';
import { ChecksGroup } from './checks-group';
import { CiGroup } from './ci-group';
import { ServicesGroup } from './services-group';
import { sectionLabelClassName } from './shared';

export const DeskSection = () => {
  const { desk, loading } = useDeskManifest();

  if (loading || !desk) return null;

  return (
    <>
      <Divider surface="chalkboard" />
      <div className="min-h-0 flex-1 p-6">
        <div className={sectionLabelClassName}>Desk</div>
        <div className="flex flex-col gap-4">
          <ServicesGroup />
          <ChecksGroup />
          <BuildGroup />
          <CiGroup />
        </div>
      </div>
    </>
  );
};
