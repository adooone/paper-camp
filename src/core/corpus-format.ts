import { readFile } from 'node:fs/promises';

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

async function readConfigVersion(configPath: string): Promise<number | null> {
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch {
    return null;
  }
  try {
    const version = (JSON.parse(raw) as { version?: unknown }).version;
    return typeof version === 'number' ? version : null;
  } catch {
    return null;
  }
}

// A corpus older than this paper-camp, or one with no version stamped at all, reads and
// writes normally — only a corpus declaring a format newer than this one is refused, since
// writing it back would silently drop fields this version doesn't know how to preserve.
export async function assertCorpusWritable(configPath: string): Promise<void> {
  const version = await readConfigVersion(configPath);
  if (version !== null && version > CORPUS_FORMAT_VERSION) {
    throw new CorpusTooNewError(version);
  }
}
