interface SectionHeadingProps {
  label: string;
  count: number;
}

export const SectionHeading = ({ label, count }: SectionHeadingProps) => {
  return (
    <div
      style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.65rem' }}
    >
      <span
        className="text-xs"
        style={{
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.4,
        }}
      >
        {label}
      </span>
      <span className="text-xs" style={{ opacity: 0.3 }}>
        {count}
      </span>
    </div>
  );
};
