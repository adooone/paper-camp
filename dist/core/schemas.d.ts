import { z } from 'zod';
export declare const planFieldsSchema: z.ZodObject<{
    status: z.ZodEnum<{
        idea: "idea";
        planned: "planned";
        "in-progress": "in-progress";
        done: "done";
        dropped: "dropped";
    }>;
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
}, z.core.$strip>;
export declare const paperCampConfigSchema: z.ZodObject<{
    version: z.ZodString;
    projectName: z.ZodString;
    initializedAt: z.ZodString;
}, z.core.$strip>;
export type PlanFields = z.infer<typeof planFieldsSchema>;
export type DecisionFields = z.infer<typeof decisionFieldsSchema>;
export type OpenQuestionFields = z.infer<typeof openQuestionFieldsSchema>;
//# sourceMappingURL=schemas.d.ts.map