function countBiomeErrors(output: string): number {
  const match = output.match(/Found (\d+) errors?\./);
  return match ? Number(match[1]) : 0;
}

/** One-sentence summary of a failed lint/format run, combining both since the
 * Status section's "Quality" stamp represents them as a single check. */
export function summarizeQualityFailure(lintOutput: string, formatOutput: string): string {
  const total = countBiomeErrors(lintOutput) + countBiomeErrors(formatOutput);
  if (total > 0) return `${total} lint/format issue${total === 1 ? '' : 's'} found.`;
  return 'Lint or format check failed.';
}

export function summarizeTestFailure(output: string): string {
  const match = output.match(/Tests\s+(\d+) failed/);
  if (match) return `${match[1]} test${match[1] === '1' ? '' : 's'} failed.`;
  return 'Tests failed.';
}
