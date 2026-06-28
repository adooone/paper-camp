import { z } from 'zod';
export declare const planFieldsSchema: z.ZodObject<{
    status: z.ZodEnum<{
        idea: "idea";
        planned: "planned";
        "in-progress": "in-progress";
        review: "review";
        done: "done";
        dropped: "dropped";
    }>;
    kind: z.ZodOptional<z.ZodEnum<{
        feat: "feat";
        fix: "fix";
        chore: "chore";
        docs: "docs";
        refactor: "refactor";
    }>>;
    id: z.ZodOptional<z.ZodString>;
    idea: z.ZodOptional<z.ZodString>;
    agent: z.ZodOptional<z.ZodEnum<{
        "claude-code": "claude-code";
        opencode: "opencode";
    }>>;
    created: z.ZodString;
    updated: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const decisionFieldsSchema: z.ZodObject<{
    date: z.ZodString;
    status: z.ZodEnum<{
        decided: "decided";
        superseded: "superseded";
    }>;
    'superseded-by': z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const openQuestionFieldsSchema: z.ZodObject<{
    status: z.ZodEnum<{
        open: "open";
        resolved: "resolved";
    }>;
    raised: z.ZodString;
    'resolved-by': z.ZodOptional<z.ZodString>;
    blocks: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const paperCampConfigSchema: z.ZodObject<{
    version: z.ZodString;
    projectName: z.ZodString;
    initializedAt: z.ZodString;
    nextId: z.ZodOptional<z.ZodObject<{
        feat: z.ZodNumber;
        fix: z.ZodNumber;
        chore: z.ZodNumber;
        docs: z.ZodNumber;
        refactor: z.ZodNumber;
    }, z.core.$strip>>;
    defaultAgent: z.ZodOptional<z.ZodEnum<{
        "claude-code": "claude-code";
        opencode: "opencode";
    }>>;
    defaultAgents: z.ZodOptional<z.ZodObject<{
        phase: z.ZodEnum<{
            "claude-code": "claude-code";
            opencode: "opencode";
        }>;
        planDraft: z.ZodEnum<{
            "claude-code": "claude-code";
            opencode: "opencode";
        }>;
        ideaExtend: z.ZodEnum<{
            "claude-code": "claude-code";
            opencode: "opencode";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PlanFields = z.infer<typeof planFieldsSchema>;
export type DecisionFields = z.infer<typeof decisionFieldsSchema>;
export type OpenQuestionFields = z.infer<typeof openQuestionFieldsSchema>;
//# sourceMappingURL=schemas.d.ts.map