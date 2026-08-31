import { writeGithubConfig } from '@/app/services/github/config-store';
import { readHubGithubToken } from '@/app/services/github/hub-token-store';
import { mountPrefix } from '@/app/services/mount';
import {
  type ProjectEntry,
  addGithubProject,
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
  addGithubEntry: (repoFullName: string) => void;
  renameEntry: (id: string, label: string) => void;
  removeEntry: (id: string) => void;
  openEntry: (id: string) => void;
}

// A full load, not a client navigation: the active project, and a GitHub
// entry's plan-only corpus source, are read once at startup.
function openProject(entry: ProjectEntry): void {
  selectProject(projectEntryId(entry), storage);
  if (entry.kind === 'github') {
    const token = readHubGithubToken();
    if (token) writeGithubConfig({ token, owner: entry.owner, repo: entry.repo });
  }
  window.location.assign(mountPrefix || '/');
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectEntry[]>(() => listProjects(storage));
  const refresh = () => setProjects(listProjects(storage));

  return {
    projects,
    addGithubEntry: (repoFullName) => {
      addGithubProject(repoFullName, storage);
      refresh();
    },
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
