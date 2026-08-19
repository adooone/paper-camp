import { readFile, writeFile } from 'node:fs/promises';

// The corpus's on-disk schema version, stored in papercamp/config.json's `version`
// field. Bumped only when the frontmatter/config shape changes — never on every
// package release — so a paper-camp reading the corpus can tell whether it
// understands the format it's looking at. Distinct from the npm package version.
export const CORPUS_FORMAT_VERSION = 1;

export class CorpusTooNewError extends Error {
  constructor(corpusVersion: number) {
    super(
      `This corpus is in format version ${corpusVersion}, newer than the format version ${CORPUS_FORMAT_VERSION} this paper-camp understands. Writes are refused so a field this version doesn’t recognise is never dropped — upgrade paper-camp to edit this corpus.`,
    );
    this.name = 'CorpusTooNewError';
  }
}

async function readConfigJson(configPath: string): Promise<Record<string, unknown> | null> {
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function configVersion(config: Record<string, unknown> | null): number | null {
  const version = config?.version;
  return typeof version === 'number' ? version : null;
}

// A corpus older than this paper-camp, or one with no version stamped at all, reads and
// writes normally — only a corpus declaring a format newer than this one is refused, since
// writing it back would silently drop fields this version doesn't know how to preserve.
export async function assertCorpusWritable(configPath: string): Promise<void> {
  const version = configVersion(await readConfigJson(configPath));
  if (version !== null && version > CORPUS_FORMAT_VERSION) {
    throw new CorpusTooNewError(version);
  }
}

export interface CorpusFormatBump {
  from: number | null;
  to: number;
}

// The explicit, reviewable counterpart to assertCorpusWritable's refusal: stamps
// config.json with the format version this paper-camp writes, producing an ordinary
// file change a human reviews via `git diff` before committing — never run implicitly
// on load. A no-op (returns null) once the corpus is already current or ahead.
export async function bumpCorpusFormat(configPath: string): Promise<CorpusFormatBump | null> {
  const config = await readConfigJson(configPath);
  if (!config) return null;
  const from = configVersion(config);
  if (from !== null && from >= CORPUS_FORMAT_VERSION) return null;
  config.version = CORPUS_FORMAT_VERSION;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  return { from, to: CORPUS_FORMAT_VERSION };
}
