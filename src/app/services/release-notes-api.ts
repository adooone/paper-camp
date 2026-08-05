import type { ReleaseNoteSection } from '@/types/index';

export const fetchReleaseVersions = async (): Promise<string[]> => {
  const response = await fetch('/api/releases');
  if (!response.ok) throw new Error('Failed to load releases');
  const { versions } = await response.json();
  return versions;
};

export const fetchReleaseNotes = async (version: string): Promise<ReleaseNoteSection[] | null> => {
  const response = await fetch(`/api/release-notes?version=${encodeURIComponent(version)}`);
  if (!response.ok) throw new Error('Failed to load release notes');
  return response.json();
};
