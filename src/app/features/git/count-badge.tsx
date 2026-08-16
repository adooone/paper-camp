interface CountBadgeProps {
  additions: number;
  deletions: number;
}

export const CountBadge = ({ additions, deletions }: CountBadgeProps) => (
  <span className="inline-flex shrink-0 gap-2 font-mono text-2xs">
    <span className="text-watercolor-green-dark">+{additions}</span>
    <span className="text-watercolor-rose-dark">-{deletions}</span>
  </span>
);
