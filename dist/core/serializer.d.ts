import { PhaseItem } from '../types/index';
export declare function todayDateString(): string;
interface NewPlanInput {
    title: string;
    status: string;
    created: string;
    updated?: string;
    tags?: string[];
    body?: string;
    phases?: PhaseItem[];
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