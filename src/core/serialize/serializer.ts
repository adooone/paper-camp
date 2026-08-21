import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

let idAssignmentChain: Promise<unknown> = Promise.resolve();

// Highest N already used by an existing `<PREFIX>-N.md` entity file on disk, across
// the live and archived entity dirs. Lets id assignment stay ahead of ids that were
// created out-of-band (e.g. a file written by hand or by a crashed run) without
// bumping the counter — otherwise the counter hands the same number out twice.
async function highestEntityIdOnDisk(campDir: string, kind: string): Promise<number> {
  const fileRe = new RegExp(`^${kind.toUpperCase()}-(\\d+)\\.md$`);
  const dirs = [
    join(campDir, 'ideas'),
    join(campDir, 'ideas', 'archive'),
    join(campDir, 'plans'),
    join(campDir, 'plans', 'archive'),
  ];
  let highest = 0;
  for (const dir of dirs) {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      continue; // dir may not exist (e.g. no plans/ in the unified-entity layout)
    }
    for (const file of files) {
      const match = fileRe.exec(file);
      if (match) highest = Math.max(highest, Number(match[1]));
    }
  }
  return highest;
}

// Chained through a module-level promise so two near-simultaneous calls in this process
// never read the same counter value; a concurrent second process is an accepted gap.
export async function assignPlanId(configPath: string, kind: string): Promise<string | undefined> {
  const run = idAssignmentChain.then(async () => {
    let config: { nextId?: Record<string, number> } | null = null;
    try {
      config = JSON.parse(await readFile(configPath, 'utf-8')) as {
        nextId?: Record<string, number>;
      };
    } catch {
      return undefined;
    }
    if (!config?.nextId) return undefined;
    // Take whichever is higher: the stored counter or one past the highest id already
    // on disk. This makes assignment collision-proof — a file that claimed an id
    // without advancing the counter can never cause the same id to be reused.
    const counter = config.nextId[kind] ?? 1;
    const highestOnDisk = await highestEntityIdOnDisk(dirname(configPath), kind);
    const next = Math.max(counter, highestOnDisk + 1);
    const id = `${kind.toUpperCase()}-${next}`;
    config.nextId[kind] = next + 1;
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    return id;
  });
  idAssignmentChain = run.catch(() => undefined);
  return run;
}

export async function assignEntityId(configPath: string): Promise<string | undefined> {
  return assignPlanId(configPath, 'idea');
}

// Chained alongside id assignment so a candidate promote's id-mint and subject-create
// writes to the same config.json can't clobber each other.
export async function ensureSubject(configPath: string, subject: string): Promise<void> {
  const run = idAssignmentChain.then(async () => {
    let config: { subjects?: string[] } | null = null;
    try {
      config = JSON.parse(await readFile(configPath, 'utf-8')) as { subjects?: string[] };
    } catch {
      return;
    }
    const subjects = config.subjects ?? [];
    if (subjects.includes(subject)) return;
    config.subjects = [...subjects, subject];
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  });
  idAssignmentChain = run.catch(() => undefined);
  return run;
}

export async function archiveEntityFile(root: string, entityId: string): Promise<boolean> {
  const ideasDir = join(root, 'papercamp', 'ideas');
  const archiveDir = join(ideasDir, 'archive');
  const sourcePath = join(ideasDir, `${entityId}.md`);
  const destPath = join(archiveDir, `${entityId}.md`);

  await mkdir(archiveDir, { recursive: true });

  try {
    await rename(sourcePath, destPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
