// CLI failures (git, agent, etc.) arrive as multi-line output ("To github…\n
// ! [rejected]…\nhint:…"); a toast wants the one line that states the problem.
const LINT_PROBLEM_PREFIX = '✖';

// commitlint prints one ✖ line per rule plus a "found N problems" total; the rule
// lines are the message, the total and the help link are not.
function commitlintSummary(lines: string[]): string | undefined {
  const problems = lines
    .filter((line) => line.startsWith(LINT_PROBLEM_PREFIX) && !/found \d+ problem/.test(line))
    .map((line) =>
      line
        .slice(LINT_PROBLEM_PREFIX.length)
        .trim()
        .replace(/\s*\[[\w-]+\]$/, ''),
    );
  if (problems.length === 0) return undefined;
  return `Commit message rejected by commitlint: ${problems.join('; ')}`;
}

export function oneLineErrorSummary(message: string): string {
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const lint = commitlintSummary(lines);
  if (lint) return lint;
  const marked = lines.find(
    (line) => line.startsWith('!') || line.startsWith('error:') || line.startsWith('fatal:'),
  );
  return marked ?? lines.at(-1) ?? message;
}
