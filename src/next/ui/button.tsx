import styles from './button.module.css';
import { Hand, type HandColor } from './hand';
import type { TextSize } from './tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: TextSize;
  accessibilityLabel?: string;
  className?: string;
}

const labelColor: Record<ButtonVariant, HandColor> = {
  primary: 'sketchInk',
  secondary: 'sketchInk',
  ghost: 'inkSoft',
};

// folk-ui's Button is a sketched portal control; the phone's is a kraft slab, an ink outline or bare ink.
export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  size = 'base',
  accessibilityLabel,
  className,
}: ButtonProps) {
  return (
    <button
      type="button"
      aria-label={accessibilityLabel}
      onClick={onPress}
      disabled={disabled}
      className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}
    >
      <Hand size={size} bold color={labelColor[variant]} className={styles.label}>
        {label}
      </Hand>
    </button>
  );
}
