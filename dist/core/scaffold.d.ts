export declare const PAPER_CAMP_VERSION = "0.1.0";
export declare class AlreadyInitializedError extends Error {
    constructor(targetDir: string);
}
export interface InitOptions {
    projectName: string;
    intent?: string;
}
/**
 * Scaffolds .paper-camp/config.json and papercamp/*.md. Never overwrites existing
 * files — a project's memory is never something `init` should clobber.
 */
export declare function initProject(targetDir: string, options: InitOptions): Promise<void>;
//# sourceMappingURL=scaffold.d.ts.map