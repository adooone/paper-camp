import { fetchReleaseNotes } from '@/app/services/release-notes-api';
import type { ReleaseNoteSection } from '@/types/index';
import { useEffect, useState } from 'react';

export type ReleaseNotesState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; sections: ReleaseNoteSection[] };

export const useReleaseNotes = (version: string): ReleaseNotesState => {
  const [state, setState] = useState<ReleaseNotesState>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    let cancelled = false;
    fetchReleaseNotes(version)
      .then((sections) => {
        if (!cancelled) setState(sections ? { status: 'ready', sections } : { status: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'missing' });
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return state;
};
