import { parse as parseYaml } from 'yaml';
import type { DoctorCheck, DoctorEntityFile } from '../doctor';
import type { DoctorFinding } from '../finding';
import type { DoctorRuleId } from '../rules';

const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?/;
const HEADING_RE = /^#{1,6}\s+(.+?)\s*$/;
const CHECKBOX_RE = /^[-*]\s+\[[ xX]\]\s+(.*)$/;
const PHASE_HEADING_RE = /^(phases|fixes)$/i;
const PHASES_HEADING_LINE_RE = /^#{1,6}\s+Phases\s*$/i;
const THREAD_TEXT_RE =
  /^(?:\d{4}-\d{2}-\d{2}\s+)?\[(?:log|clarification|review|note|decision|question|chat)\]/;
const NOTE_ANCHOR_RE = /^\[(?:phase:\d+|body)\]/;
const WIKILINK_RE = /\[\[\s*(IDEA-\d+)(?:\s*\|[^\]]*)?\s*\]\]/g;

const ACTIVE_STATUSES = new Set(['idea', 'planned', 'in-progress', 'review', 'open']);
const CLOSED_STATUSES = new Set(['done', 'dropped']);

function frontmatterData(content: string): Record<string, unknown> | null {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;
  try {
    const parsed = parseYaml(match[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}
  return null;
}

function lineOf(content: string, re: RegExp): number {
  const idx = content.split('\n').findIndex((line) => re.test(line));
  return idx === -1 ? 1 : idx + 1;
}

function mk(
  file: DoctorEntityFile,
  line: number,
  rule: DoctorRuleId,
  message: string,
): DoctorFinding {
  return { file: file.path, line, rule, message };
}

const checkPhasesListSplit: DoctorCheck = ({ files }) =>
  files.flatMap((file) => {
    const lines = file.content.split('\n');
    const findings: DoctorFinding[] = [];
    let inPhaseSection = false;

    for (let i = 0; i < lines.length; i++) {
      const heading = lines[i].match(HEADING_RE);
      if (heading) {
        inPhaseSection = PHASE_HEADING_RE.test(heading[1].trim());
        continue;
      }
      if (inPhaseSection) continue;
      const box = lines[i].match(CHECKBOX_RE);
      if (!box) continue;
      const text = box[1].trim();
      if (THREAD_TEXT_RE.test(text) || NOTE_ANCHOR_RE.test(text)) continue;
      findings.push(
        mk(
          file,
          i + 1,
          'phases-list-split',
          `orphaned phase checkbox outside any Phases section: "${lines[i].trim()}"`,
        ),
      );
    }
    return findings;
  });

const checkNoteHasPhases: DoctorCheck = ({ files }) =>
  files.flatMap((file) => {
    if (frontmatterData(file.content)?.kind !== 'note') return [];
    const lines = file.content.split('\n');
    const idx = lines.findIndex((line) => PHASES_HEADING_LINE_RE.test(line));
    if (idx === -1) return [];
    return [mk(file, idx + 1, 'note-has-phases', 'a kind: note entity carries a Phases section')];
  });

const checkArchivePlacement: DoctorCheck = ({ files }) =>
  files.flatMap((file) => {
    const status = frontmatterData(file.content)?.status;
    if (typeof status !== 'string') return [];
    const line = lineOf(file.content, /^status:/);
    if (file.archived && ACTIVE_STATUSES.has(status)) {
      return [
        mk(
          file,
          line,
          'archive-placement',
          `status "${status}" is active but the file is under ideas/archive/`,
        ),
      ];
    }
    if (!file.archived && CLOSED_STATUSES.has(status)) {
      return [
        mk(
          file,
          line,
          'archive-placement',
          `status "${status}" is closed but the file is still under ideas/ — it should be archived`,
        ),
      ];
    }
    return [];
  });

const checkDanglingLink: DoctorCheck = ({ files }) => {
  const known = new Set<string>();
  for (const file of files) {
    known.add(file.id);
    const id = frontmatterData(file.content)?.id;
    if (typeof id === 'string') known.add(id);
  }

  return files.flatMap((file) => {
    const lines = file.content.split('\n');
    const findings: DoctorFinding[] = [];
    for (let i = 0; i < lines.length; i++) {
      for (const match of lines[i].matchAll(WIKILINK_RE)) {
        if (!known.has(match[1])) {
          findings.push(
            mk(
              file,
              i + 1,
              'dangling-link',
              `[[${match[1]}]] points at an id no entity in the corpus defines`,
            ),
          );
        }
      }
    }
    return findings;
  });
};

export const structuralChecks: DoctorCheck[] = [
  checkPhasesListSplit,
  checkNoteHasPhases,
  checkArchivePlacement,
  checkDanglingLink,
];
