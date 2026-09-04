interface IllustrationProps {
  className?: string;
}

export const EmptyTrayIllustration = ({ className = 'h-auto w-full' }: IllustrationProps) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <ellipse cx="50" cy="38" rx="30" ry="7" />
    <path d="M20 38 L31 76 H69 L80 38" />
  </svg>
);

export const RestingPenIllustration = ({ className = 'h-auto w-full' }: IllustrationProps) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M27 78 L38 69 L79 28 L84 33 L43 74 Z" />
    <path d="M30 75 L34 71" />
    <path d="M16 85 H84" />
  </svg>
);

export const CleanSheetIllustration = ({ className = 'h-auto w-full' }: IllustrationProps) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M30 15 H62 L75 28 V85 H30 Z" />
    <path d="M62 15 L62 28 H75" />
  </svg>
);

export const MagnifierIllustration = ({ className = 'h-auto w-full' }: IllustrationProps) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="42" cy="42" r="22" />
    <path d="M58 58 L80 80" />
  </svg>
);
