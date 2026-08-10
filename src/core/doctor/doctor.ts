import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { PaperCampConfig } from '../../types/index';
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

export const DOCTOR_CHECKS: DoctorCheck[] = [];

async function readdirMaybe(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function readFileMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

async function readConfig(configPath: string): Promise<PaperCampConfig | null> {
  const raw = await readFileMaybe(configPath);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PaperCampConfig;
  } catch {
    return null;
  }
}

export async function collectDoctorContext(paperCampDir: string): Promise<DoctorContext> {
  const ideasDir = join(paperCampDir, 'ideas');
  const files: DoctorEntityFile[] = [];

  for (const dir of [ideasDir, join(ideasDir, 'archive')]) {
    const archived = dir !== ideasDir;
    const names = (await readdirMaybe(dir)).filter((f) => f.endsWith('.md') && f !== 'index.md');
    for (const name of names.sort()) {
      files.push({
        id: basename(name, '.md'),
        path: `papercamp/ideas${archived ? '/archive' : ''}/${name}`,
        content: await readFileMaybe(join(dir, name)),
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
