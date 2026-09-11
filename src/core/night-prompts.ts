import type { NightRawFinding } from '../types/index';

export interface NightCheckPromptInput {
  name: string;
  instructions: string;
  chunkPath: string;
  files: string[];
  sinceCommit: string | null;
  diff: string;
}

export function buildNightCheckPrompt(input: NightCheckPromptInput): string {
  const fileList = input.files.length > 0 ? input.files.join('\n') : '(no files in this chunk)';
  const diffSection = input.sinceCommit
    ? `Diff since the last review of this chunk (commit ${input.sinceCommit}):\n${input.diff || '(no changes since then)'}`
    : 'This is the first review of this chunk — no prior commit to diff against.';

  return `You are running an automated, read-only "${input.name}" review of one folder in this repository, as part of an unattended night shift. You may read files and search the codebase with your tools, but you must not edit, write, or otherwise modify anything — this session has no write access and any attempt will fail.

Chunk: ${input.chunkPath}

Files in this chunk, at the commit checked out here:
${fileList}

${diffSection}

Task: review this chunk for ${input.instructions}. Only report a finding you can point to a specific file (and line, if applicable) for, and that you are reasonably confident about — do not report stylistic nitpicks or speculation.

Respond with ONLY a single JSON array, no prose, no code fences, no markdown — exactly this shape:
[{"file": "<path relative to the repo root>", "line": <line number, or null>, "message": "<one or two sentences describing the issue>"}]
If you find nothing, respond with exactly: []`;
}

export interface NightConfirmPromptInput {
  checkName: string;
  finding: NightRawFinding;
}

export function buildNightConfirmPrompt(input: NightConfirmPromptInput): string {
  const { finding } = input;
  return `You are the confirming pass for one candidate finding from an automated "${input.checkName}" review, run as part of an unattended night shift. Read the file yourself and verify whether this finding is real and worth a human's attention — do not trust the description alone. You must not edit, write, or otherwise modify anything.

File: ${finding.file}
Reported line: ${finding.line ?? 'unspecified'}
Candidate finding: ${finding.message}

Task: read the file, then decide:
1. Is this a genuine issue, not a false positive and not already handled elsewhere in the file?
2. If genuine, its severity: "critical" for data loss, a security hole, or a crash on a main path; "high" for a wrong result a user would see; "normal" for everything else.

Respond with ONLY a single JSON object, no prose, no code fences, no markdown — exactly this shape:
{"confirmed": true or false, "severity": "critical" or "high" or "normal" or null, "reasoning": "<one sentence>"}
severity must be null when confirmed is false.`;
}
