import { useDeskManifest } from '@/app/hooks/use-desk-manifest';
import { Accordion, Divider } from '@dendelion/paper-ui';
import { useState } from 'react';
import { ChecksGroup } from './checks-group';
import { CiGroup } from './ci-group';
import { ServicesGroup } from './services-group';

const DESK_EXPANDED_KEY = 'desk-section-expanded';

const readExpanded = (): boolean => {
  try {
    return localStorage.getItem(DESK_EXPANDED_KEY) === 'true';
  } catch {
    return false;
  }
};

const writeExpanded = (value: boolean): void => {
  try {
    localStorage.setItem(DESK_EXPANDED_KEY, String(value));
  } catch {
    // localStorage unavailable (e.g. private browsing) — keep the in-memory value only
  }
};

export const DeskSection = () => {
  const { desk, loading } = useDeskManifest();
  const [expanded, setExpanded] = useState(readExpanded);

  if (loading || !desk) return null;

  const toggle = () => {
    const next = !expanded;
    writeExpanded(next);
    setExpanded(next);
  };

  return (
    <>
      <Divider surface="chalkboard" />
      <div className="p-6">
        <Accordion title="Desk" surface="chalkboard" expanded={expanded} onToggle={toggle}>
          <div className="flex flex-col gap-4">
            <ServicesGroup />
            <ChecksGroup />
            <CiGroup />
          </div>
        </Accordion>
      </div>
    </>
  );
};
