interface CountBadgeProps {
  additions: number;
  deletions: number;
}

export const CountBadge = ({ additions, deletions }: CountBadgeProps) => (
  <span className="inline-flex shrink-0 gap-1.5 font-mono text-3xs">
    <span className="text-watercolor-green-dark">+{additions}</span>
    <span className="text-watercolor-rose-dark">-{deletions}</span>
  </span>
);
