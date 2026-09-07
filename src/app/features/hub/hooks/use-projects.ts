import { mountPrefix } from '@/app/services/mount';
import {
  type ProjectEntry,
  listProjects,
  projectEntryId,
  removeProject,
  renameProject,
  selectProject,
} from '@/app/services/project-registry';
import { useState } from 'react';

const storage = typeof window === 'undefined' ? null : window.localStorage;

export interface UseProjectsResult {
  projects: ProjectEntry[];
  renameEntry: (id: string, label: string) => void;
  removeEntry: (id: string) => void;
  openEntry: (id: string) => void;
}

// A full load, not a client navigation: the active project is read once at startup.
function openProject(entry: ProjectEntry): void {
  selectProject(projectEntryId(entry), storage);
  window.location.assign(mountPrefix || '/');
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectEntry[]>(() => listProjects(storage));
  const refresh = () => setProjects(listProjects(storage));

  return {
    projects,
    renameEntry: (id, label) => {
      renameProject(id, label, storage);
      refresh();
    },
    removeEntry: (id) => {
      removeProject(id, storage);
      refresh();
    },
    openEntry: (id) => {
      const entry = projects.find((candidate) => projectEntryId(candidate) === id);
      if (entry) openProject(entry);
    },
  };
}
