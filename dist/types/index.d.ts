export type PlanStatus = 'idea' | 'planned' | 'in-progress' | 'done' | 'dropped';
export type DecisionStatus = 'decided' | 'superseded';
export type QuestionStatus = 'open' | 'resolved';
export interface PhaseItem {
    done: boolean;
    text: string;
}
/** Raw shape produced by the generic heading-block parser, before per-file validation. */
export interface RawEntry {
    title: string;
    fields: Record<string, string>;
    body: string;
    phases: PhaseItem[];
}
export interface ParseWarning {
    title: string;
    message: string;
}
export interface ParseResult<T> {
    entries: T[];
    warnings: ParseWarning[];
}
export interface PlanEntry {
    title: string;
    status: PlanStatus;
    created: string;
    updated?: string;
    tags: string[];
    body: string;
    phases: PhaseItem[];
}
export interface DecisionEntry {
    title: string;
    date: string;
    status: DecisionStatus;
    supersededBy?: string;
    body: string;
}
export interface OpenQuestionEntry {
    title: string;
    status: QuestionStatus;
    raised: string;
    resolvedBy?: string;
    body: string;
}
export interface ProgressEntry {
    date: string;
    items: string[];
}
export interface PaperCampConfig {
    version: string;
    projectName: string;
    initializedAt: string;
}
//# sourceMappingURL=index.d.ts.map