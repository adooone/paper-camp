import { ConsistencyIssue, DecisionEntry, IdeaEntry, OpenQuestionEntry, ParseResult, PlanEntry, ProgressEntry, RawEntry } from '../types/index';
export declare function parseRawEntries(markdown: string): RawEntry[];
export declare function parsePlans(markdown: string): ParseResult<PlanEntry>;
export declare function parseDecisions(markdown: string): ParseResult<DecisionEntry>;
export declare function parseOpenQuestions(markdown: string): ParseResult<OpenQuestionEntry>;
/** ideas.md is split into sections by `---` separators. Each section has an optional
 * `### IDEA-N:` heading prefix followed by a short title, and a prose body. */
export declare function parseIdeas(markdown: string): IdeaEntry[];
export declare function deriveIdeaStatuses(ideas: IdeaEntry[], plans: PlanEntry[]): IdeaEntry[];
/** Read-only cross-reference checks over already-parsed decisions/open-questions/plans —
 * dangling `resolved-by`/`superseded-by` titles, and open questions blocking an
 * already-active plan. */
export declare function findConsistencyIssues(decisions: DecisionEntry[], openQuestions: OpenQuestionEntry[], plans: PlanEntry[]): ConsistencyIssue[];
/** progress.md is an append-only date log, not a record-based file — no fields, no validation. */
export declare function parseProgress(markdown: string): ProgressEntry[];
//# sourceMappingURL=parser.d.ts.map