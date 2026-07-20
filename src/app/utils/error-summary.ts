// CLI failures (git, agent, etc.) arrive as multi-line output ("To github…\n
// ! [rejected]…\nhint:…"); a toast wants the one line that states the problem.
export function oneLineErrorSummary(message: string): string {
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const marked = lines.find(
    (line) => line.startsWith('!') || line.startsWith('error:') || line.startsWith('fatal:'),
  );
  return marked ?? lines.at(-1) ?? message;
}
