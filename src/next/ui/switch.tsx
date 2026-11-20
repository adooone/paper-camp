import styles from './switch.module.css';

interface SwitchProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

// folk-ui's Switch is a sketched toggle; the phone's is a kraft track under a plain thumb.
export function Switch({ value, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={value ? `${styles.track} ${styles.on}` : styles.track}
    >
      <span className={styles.thumb} />
    </button>
  );
}
