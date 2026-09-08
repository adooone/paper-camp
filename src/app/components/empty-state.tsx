import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: ReactNode;
  action?: ReactNode;
  illustration?: string;
  className?: string;
}

export const EmptyState = ({ message, action, illustration, className = '' }: EmptyStateProps) => (
  <div className={`flex flex-col items-center gap-3 py-6 text-center ${className}`}>
    {illustration && (
      // paper-ui has no image component; the doodle pack is a plain SVG file the hosted
      // client fetches, so a build without it (PAPERCAMP_ASSETS_URL unset) 404s quietly.
      <img
        src={`/img/doodles/${illustration}.svg`}
        alt=""
        aria-hidden="true"
        className="h-24 w-24"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    )}
    <p className="m-0 font-handwritten text-base opacity-60">{message}</p>
    {action}
  </div>
);
