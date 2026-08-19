// The corpus's on-disk schema version, stored in papercamp/config.json's `version`
// field. Bumped only when the frontmatter/config shape changes — never on every
// package release — so a paper-camp reading the corpus can tell whether it
// understands the format it's looking at. Distinct from the npm package version.
export const CORPUS_FORMAT_VERSION = 1;
