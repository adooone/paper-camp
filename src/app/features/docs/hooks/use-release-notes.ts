import { fetchReleaseNotes } from '@/app/services/release-notes-api';
import type { ReleaseNoteSection } from '@/types/index';
import { useEffect, useState } from 'react';

export const useReleaseNotes = (version: string | null): ReleaseNoteSection[] | null => {
  const [sections, setSections] = useState<ReleaseNoteSection[] | null>(null);

  useEffect(() => {
    setSections(null);
    if (!version) return;
    let cancelled = false;
    fetchReleaseNotes(version)
      .then((result) => {
        if (!cancelled) setSections(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  return sections;
};
