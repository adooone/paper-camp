import { LogEntry, PhaseItem } from '../types/index';
export declare function todayDateString(): string;
/**
 * Mints the next `<KIND>-<N>` plan ID from the persistent counter in `.paper-camp/config.json`,
 * incrementing and writing it back. Calls are chained through a module-level promise so two
 * near-simultaneous calls within this process never read the same counter value and mint a
 * duplicate ID — this does not protect against a concurrent call from a separate process (e.g.
 * the CLI racing the dev server), which is an accepted gap for a local single-user tool.
 * Returns undefined if the config file is missing or has no `nextId` counters yet.
 */
export declare function assignPlanId(configPath: string, kind: string): Promise<string | undefined>;
interface NewPlanInput {
    title: string;
    status: string;
    kind?: string;
    id?: string;
    idea?: string;
    agent?: string;
    created: string;
    updated?: string;
    tags?: string[];
    body?: string;
    phases?: PhaseItem[];
    log?: LogEntry[];
    clarifications?: LogEntry[];
}
export declare function formatPlanEntry(input: NewPlanInput): string;
interface NewDecisionInput {
    title: string;
    date: string;
    status: string;
    supersededBy?: string;
    body?: string;
}
export declare function formatDecisionEntry(input: NewDecisionInput): string;
interface NewOpenQuestionInput {
    title: string;
    raised: string;
    status: string;
    resolvedBy?: string;
    blocks?: string;
    body?: string;
}
export declare function formatOpenQuestionEntry(input: NewOpenQuestionInput): string;
export declare function formatProgressEntry(date: string, items: string[]): string;
/** Serializes an array of plan entries back to a plans.md file. */
export declare function formatPlans(entries: NewPlanInput[]): string;
/** Appends a pre-formatted block to a papercamp file, separated by a single blank line. */
export declare function appendBlock(filePath: string, block: string): Promise<void>;
export {};
//# sourceMappingURL=serializer.d.ts.map