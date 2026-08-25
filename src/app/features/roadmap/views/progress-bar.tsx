interface ProgressBarProps {
  done: number;
  total: number;
}

export const ProgressBar = ({ done, total }: ProgressBarProps) => {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="w-24 h-1.5 rounded-full bg-black/[0.08] overflow-hidden shrink-0">
      <div
        className={`h-full rounded-full ${total > 0 ? 'bg-watercolor-green' : 'bg-transparent'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};
