import { DecisionEntry, OpenQuestionEntry, ParseResult, PlanEntry, ProgressEntry, RawEntry } from '../types/index';
/**
 * Splits a papercamp markdown file into `## Heading` blocks, each with an optional
 * `**Key:** value` fields block immediately below the heading, a prose body, and an
 * optional `### Phases` checkbox list. Used for plans.md, decisions.md, open-questions.md.
 */
export declare function parseRawEntries(markdown: string): RawEntry[];
export declare function parsePlans(markdown: string): ParseResult<PlanEntry>;
export declare function parseDecisions(markdown: string): ParseResult<DecisionEntry>;
export declare function parseOpenQuestions(markdown: string): ParseResult<OpenQuestionEntry>;
/** progress.md is an append-only date log, not a record-based file — no fields, no validation. */
export declare function parseProgress(markdown: string): ProgressEntry[];
//# sourceMappingURL=parser.d.ts.map