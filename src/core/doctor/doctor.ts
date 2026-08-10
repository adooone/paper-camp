import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { PaperCampConfig } from '../../types/index';
import { metadataChecks } from './checks/metadata';
import { structuralChecks } from './checks/structural';
import type { DoctorFinding } from './finding';

export interface DoctorEntityFile {
  id: string;
  path: string;
  content: string;
  archived: boolean;
}

export interface DoctorContext {
  files: DoctorEntityFile[];
  config: PaperCampConfig | null;
}

export type DoctorCheck = (context: DoctorContext) => DoctorFinding[];

export const DOCTOR_CHECKS: DoctorCheck[] = [...metadataChecks, ...structuralChecks];

function isEnoent(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT';
}

// Only a missing directory is benign; any other failure (unreadable dir, permissions)
// must surface rather than masquerade as an empty corpus.
async function readdirOptional(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if (isEnoent(error)) return [];
    throw error;
  }
}

async function readConfig(configPath: string): Promise<PaperCampConfig | null> {
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }
  try {
    return JSON.parse(raw) as PaperCampConfig;
  } catch {
    return null;
  }
}

export async function collectDoctorContext(paperCampDir: string): Promise<DoctorContext> {
  const ideasDir = join(paperCampDir, 'ideas');
  const files: DoctorEntityFile[] = [];

  const dirs = [
    { dir: ideasDir, archived: false, names: await readdir(ideasDir) },
    {
      dir: join(ideasDir, 'archive'),
      archived: true,
      names: await readdirOptional(join(ideasDir, 'archive')),
    },
  ];

  for (const { dir, archived, names } of dirs) {
    const mdNames = names.filter((f) => f.endsWith('.md') && f !== 'index.md').sort();
    for (const name of mdNames) {
      files.push({
        id: basename(name, '.md'),
        path: `papercamp/ideas${archived ? '/archive' : ''}/${name}`,
        content: await readFile(join(dir, name), 'utf-8'),
        archived,
      });
    }
  }

  return { files, config: await readConfig(join(paperCampDir, 'config.json')) };
}

export function runDoctorChecks(context: DoctorContext): DoctorFinding[] {
  return DOCTOR_CHECKS.flatMap((check) => check(context));
}

export async function runDoctor(paperCampDir: string): Promise<DoctorFinding[]> {
  return runDoctorChecks(await collectDoctorContext(paperCampDir));
}
