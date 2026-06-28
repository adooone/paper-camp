import { EnvEntry } from '../types/index';
/** Parses `KEY=value` lines, skipping comments and blank lines. */
export declare function parseEnv(content: string): EnvEntry[];
/**
 * Replaces matched-key lines in place, drops keys no longer present, and appends
 * new keys at the end — preserving comments and the ordering of every untouched line.
 */
export declare function applyEnvEntries(content: string, entries: EnvEntry[]): string;
//# sourceMappingURL=env.d.ts.map