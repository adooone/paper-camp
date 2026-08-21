/** Parses the entity id a feature branch encodes (feat/idea-43-… → IDEA-43). */
export const branchEntityId = (branch: string | null): string | null => {
  const match = branch?.match(/^[a-z]+\/([a-z]+-\d+)-/);
  return match ? match[1].toUpperCase() : null;
};
