import { parse as parseYaml } from 'yaml';
import { CORPUS_FORMAT_VERSION } from '../../corpus-format';
import { entityFrontmatterSchema } from '../../parse/schemas';
import type { DoctorCheck, DoctorEntityFile } from '../doctor';
import type { DoctorFinding } from '../finding';
import type { DoctorRuleId } from '../rules';

const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?/;
const YAML_FIRST_LINE = 2;

interface Frontmatter {
  yaml: string;
  data: Record<string, unknown> | null;
}

function readFrontmatter(file: DoctorEntityFile): Frontmatter | null {
  const match = file.content.match(FRONTMATTER_RE);
  if (!match) return null;
  let data: Record<string, unknown> | null = null;
  try {
    const parsed = parseYaml(match[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {}
  return { yaml: match[1], data };
}

function fieldLine(yaml: string, field: string): number {
  const re = new RegExp(`^\\s*${field}:`);
  const idx = yaml.split('\n').findIndex((line) => re.test(line));
  return idx === -1 ? 1 : YAML_FIRST_LINE + idx;
}

function idLine(file: DoctorEntityFile): number {
  const fm = readFrontmatter(file);
  return fm ? fieldLine(fm.yaml, 'id') : 1;
}

function effectiveId(file: DoctorEntityFile): string {
  const id = readFrontmatter(file)?.data?.id;
  return typeof id === 'string' ? id : file.id;
}

function mk(
  file: DoctorEntityFile,
  line: number,
  rule: DoctorRuleId,
  message: string,
): DoctorFinding {
  return { file: file.path, line, rule, message };
}

const checkFrontmatterSchema: DoctorCheck = ({ files }) =>
  files.flatMap((file) => {
    const match = file.content.match(FRONTMATTER_RE);
    if (!match) {
      return [mk(file, 1, 'frontmatter-schema', 'missing YAML frontmatter block')];
    }

    let parsed: unknown;
    try {
      parsed = parseYaml(match[1]);
    } catch (err) {
      return [mk(file, 1, 'frontmatter-schema', `invalid YAML: ${(err as Error).message}`)];
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return [mk(file, 1, 'frontmatter-schema', 'frontmatter is not a key/value mapping')];
    }

    const result = entityFrontmatterSchema.safeParse(parsed);
    if (result.success) return [];

    return result.error.issues.map((issue) => {
      const field = String(issue.path[0] ?? '');
      const message =
        issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message;
      return mk(file, field ? fieldLine(match[1], field) : 1, 'frontmatter-schema', message);
    });
  });

const checkFilenameId: DoctorCheck = ({ files }) =>
  files.flatMap((file) => {
    const id = readFrontmatter(file)?.data?.id;
    if (typeof id !== 'string' || id === file.id) return [];
    return [
      mk(
        file,
        idLine(file),
        'filename-id-mismatch',
        `frontmatter id "${id}" does not match file name ${file.id}.md`,
      ),
    ];
  });

const checkDuplicateId: DoctorCheck = ({ files }) => {
  const byId = new Map<string, DoctorEntityFile[]>();
  for (const file of files) {
    const id = effectiveId(file);
    const group = byId.get(id);
    if (group) group.push(file);
    else byId.set(id, [file]);
  }

  const findings: DoctorFinding[] = [];
  for (const [id, group] of byId) {
    if (group.length < 2) continue;
    const paths = group.map((f) => f.path).join(', ');
    for (const file of group) {
      findings.push(
        mk(
          file,
          idLine(file),
          'duplicate-id',
          `id ${id} is defined by ${group.length} files: ${paths}`,
        ),
      );
    }
  }
  return findings;
};

const checkIdCounter: DoctorCheck = ({ files, config }) => {
  const next = config?.nextId?.idea;
  if (next == null) return [];

  return files.flatMap((file) => {
    const id = effectiveId(file);
    const match = id.match(/^IDEA-(\d+)$/);
    if (!match) return [];
    const num = Number(match[1]);
    if (num < next) return [];
    return [
      mk(
        file,
        idLine(file),
        'id-counter-stale',
        `id ${id} is >= config nextId.idea (${next}); the next minted id would collide`,
      ),
    ];
  });
};

const checkCorpusFormatVersion: DoctorCheck = ({ config }) => {
  const version = config?.version;
  if (typeof version !== 'number' || version <= CORPUS_FORMAT_VERSION) return [];
  return [
    {
      file: 'papercamp/config.json',
      line: 1,
      rule: 'corpus-format-too-new',
      message: `config.version ${version} is newer than the format version ${CORPUS_FORMAT_VERSION} this paper-camp understands; writes are refused until it's upgraded`,
    },
  ];
};

export const metadataChecks: DoctorCheck[] = [
  checkFrontmatterSchema,
  checkFilenameId,
  checkDuplicateId,
  checkIdCounter,
  checkCorpusFormatVersion,
];
