import { mountPrefix } from '@/app/services/mount';
import {
  type ProjectEntry,
  listProjects,
  removeProject,
  renameProject,
  selectProject,
} from '@/app/services/project-registry';
import { useState } from 'react';

const storage = typeof window === 'undefined' ? null : window.localStorage;

export interface UseProjectsResult {
  projects: ProjectEntry[];
  refresh: () => void;
  renameEntry: (id: string, label: string) => void;
  removeEntry: (id: string) => void;
  openEntry: (id: string) => void;
}

// A full load, not a client navigation: the active project is read once at
// startup, so opening a row has to reload rather than route within the SPA.
function openProject(id: string): void {
  selectProject(id, storage);
  window.location.assign(mountPrefix || '/');
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectEntry[]>(() => listProjects(storage));
  const refresh = () => setProjects(listProjects(storage));

  return {
    projects,
    refresh,
    renameEntry: (id, label) => {
      renameProject(id, label, storage);
      refresh();
    },
    removeEntry: (id) => {
      removeProject(id, storage);
      refresh();
    },
    openEntry: openProject,
  };
}
