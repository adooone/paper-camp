import { readFile, writeFile } from 'node:fs/promises';

/**
 * The corpus's on-disk schema version, stored in papercamp/config.json's `version`
 * field. Bumped only when the frontmatter/config shape changes, not on every package
 * release. Distinct from the npm package version.
 */
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

/**
 * Refuses only a corpus declaring a format newer than this paper-camp's, since writing
 * it back would silently drop fields this version can't preserve. Older/unstamped is fine.
 */
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

/**
 * Explicit, reviewable counterpart to assertCorpusWritable: stamps config.json with the
 * current format version as an ordinary file change for `git diff`, never run implicitly
 * on load. No-op (returns null) if the corpus is already current or ahead.
 */
export async function bumpCorpusFormat(configPath: string): Promise<CorpusFormatBump | null> {
  const config = await readConfigJson(configPath);
  if (!config) return null;
  const from = configVersion(config);
  if (from !== null && from >= CORPUS_FORMAT_VERSION) return null;
  config.version = CORPUS_FORMAT_VERSION;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  return { from, to: CORPUS_FORMAT_VERSION };
}
