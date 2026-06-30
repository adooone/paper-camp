/**
 * Re-exports from `schemas.ts` for backwards compatibility.
 *
 * This file is referenced by `papercamp/about.md` as the "single source of truth"
 * for the frontmatter format. Keeping it as a thin barrel means existing docs/links
 * don't break while the actual schemas live alongside their field-based counterparts
 * in one file.
 */
export {
  dateString,
  planFrontmatterSchema,
  ideaFrontmatterSchema,
} from './schemas';
export type { PlanFrontmatter, IdeaFrontmatter } from './schemas';
