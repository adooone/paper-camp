import type { PhaseRun, RunUsage } from '../types/index';

function trimDecimal(value: number, places: number): string {
  return value
    .toFixed(places)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1');
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
  if (minutes > 0) return seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

function parseDuration(text: string): number {
  const match = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || (!match[1] && !match[2] && !match[3])) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${trimDecimal(n / 1_000_000, 1)}M`;
  if (n >= 1000) return `${trimDecimal(n / 1000, 1)}k`;
  return `${Math.round(n)}`;
}

function parseTokens(text: string): number {
  const match = text.match(/^([\d.]+)([kM]?)$/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  if (match[2] === 'M') return Math.round(value * 1_000_000);
  if (match[2] === 'k') return Math.round(value * 1000);
  return Math.round(value);
}

export function shortModel(model: string): string {
  return model
    .replace(/^(?:[\w.]+\.)?anthropic\./, '')
    .replace(/^claude-/, '')
    .replace(/-\d{6,8}$/, '');
}

export function formatRunLine(run: PhaseRun): string {
  const parts = [
    formatDuration(run.durationMs),
    `${formatTokens(run.inputTokens)} in`,
    `${formatTokens(run.outputTokens)} out`,
  ];
  if (run.model) parts.push(run.model);
  if (run.attempts > 1) parts.push(`×${run.attempts}`);
  return parts.join(' · ');
}

export function parseRunLine(value: string): PhaseRun | undefined {
  const segments = value
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return undefined;
  const run: PhaseRun = {
    durationMs: parseDuration(segments[0]),
    inputTokens: 0,
    outputTokens: 0,
    attempts: 1,
  };
  for (const segment of segments.slice(1)) {
    const inMatch = segment.match(/^(.+)\s+in$/);
    const outMatch = segment.match(/^(.+)\s+out$/);
    const attemptMatch = segment.match(/^×(\d+)$/);
    if (inMatch) run.inputTokens = parseTokens(inMatch[1]);
    else if (outMatch) run.outputTokens = parseTokens(outMatch[1]);
    else if (attemptMatch) run.attempts = Number(attemptMatch[1]);
    else run.model = segment;
  }
  return run;
}

export function mergeRun(prev: PhaseRun | undefined, usage: RunUsage): PhaseRun {
  return {
    durationMs: (prev?.durationMs ?? 0) + usage.durationMs,
    inputTokens: (prev?.inputTokens ?? 0) + usage.inputTokens,
    outputTokens: (prev?.outputTokens ?? 0) + usage.outputTokens,
    model: usage.model ? shortModel(usage.model) : prev?.model,
    attempts: (prev?.attempts ?? 0) + 1,
  };
}
