interface LinkButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}

export const LinkButton = ({ children, onClick }: LinkButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-transparent border-none p-0 text-watercolor-amber-dark cursor-pointer underline [font:inherit]"
  >
    {children}
  </button>
);
