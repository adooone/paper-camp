import type { ProjectEvidence } from '@/core/desk-discovery/evidence';
import { deskConfigSchema } from '@/core/parse';
import type { DeskConfig } from '@/types/index';

function buildPrompt(evidence: ProjectEvidence): string {
  return `You are proposing a desk manifest for a project's Stack panel, from deterministic evidence gathered about the repository. Do not use any tools, do not read or edit any files — base your answer only on the evidence given.

The desk config has three optional sections:
- "services": long-running processes with their own start command, e.g. a dev server. Each entry is {"name": string, "cmd": string, "port": number (optional), "healthcheck": string (optional, a URL the service should answer on once healthy)}.
- "checks": one-shot commands that run to completion and pass or fail, e.g. lint, type-check, or test scripts. Each entry is {"name": string, "cmd": string}.
- "ci": {"repo": "owner/repo", "branch": string (optional), "releasePlease": boolean (optional)}. Fill "repo" from the evidence's git origin slug and omit "ci" entirely when there is no git origin slug.

Classify each package.json script and each non-JS manifest's declared target as one service (starts a long-running process — e.g. a name like "dev"/"serve"/"start", or a command with a --watch/--port flag), one check (runs to completion — e.g. lint/test/build/typecheck), or omit it entirely if it doesn't belong on the panel (e.g. a postinstall hook or a script that only wraps another script already listed). Use the evidence's detected dev port on the service it belongs to. Give each entry a short, human-readable "name" for the panel — not the raw script name.

Evidence:
${JSON.stringify(evidence, null, 2)}

Respond with ONLY a single JSON object, no prose, no code fences, no markdown, conforming exactly to the shape above.`;
}

/** One-shot read-only agent call, mirroring commit-suggest.ts's shape: the process
 * spawn lives in agent.ts's runReadOnlyPrompt(), passed in so this stays testable
 * without spawning a real agent. Invalid or unparsable output throws — the caller
 * must never write a rejected proposal to config.json. */
export async function discoverDeskConfig(
  evidence: ProjectEvidence,
  runPrompt: (prompt: string) => Promise<string>,
): Promise<DeskConfig> {
  const prompt = buildPrompt(evidence);
  const output = await runPrompt(prompt);

  let resultText = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') resultText = parsed.result;
  } catch {}

  const match = resultText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent did not return a parseable desk config');

  let data: unknown;
  try {
    data = JSON.parse(match[0]);
  } catch {
    throw new Error('Agent did not return valid JSON for the desk config');
  }

  const result = deskConfigSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Agent's desk config did not match the schema: ${result.error.message}`);
  }
  return result.data;
}
