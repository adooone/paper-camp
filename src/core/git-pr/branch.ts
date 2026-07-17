/** Matches the `kind/id-slug` convention that `branchEntityId`/`getFeatureBranchPlanId`
 * parse back out — shared so branch creation and PR resolution target the same name. */
export function branchName(
  id: string | undefined,
  type: string | undefined,
  title: string,
): string | undefined {
  if (!id) return undefined;
  const kind = (type ?? 'feat').toLowerCase();
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${kind}/${id.toLowerCase()}-${slug}`;
}
