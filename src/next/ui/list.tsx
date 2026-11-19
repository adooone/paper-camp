import type { ReactNode } from 'react';
import { Hand } from './hand';
import styles from './list.module.css';

interface ListLabelProps {
  children: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
}

const join = (...classes: (string | false | undefined)[]): string =>
  classes.filter(Boolean).join(' ');

// folk-ui's SectionHeading is a display title; the phone's list label is small uppercase body text.
export function ListLabel({ children, trailing, onPress }: ListLabelProps) {
  const body = (
    <>
      <Hand size="sm" bold color="inkSoft" className={styles.labelText}>
        {children}
      </Hand>
      {trailing}
    </>
  );
  if (onPress) {
    return (
      <button type="button" onClick={onPress} className={join(styles.label, styles.pressable)}>
        {body}
      </button>
    );
  }
  return <div className={styles.label}>{body}</div>;
}

interface ListRowProps {
  title: ReactNode;
  detail?: ReactNode;
  eyebrow?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  muted?: boolean;
}

// folk-ui's ListItem is a ruled line; the phone's row is a stroked sheet of fixed height.
export function ListRow({
  title,
  detail,
  eyebrow,
  trailing,
  onPress,
  accessibilityLabel,
  muted,
}: ListRowProps) {
  const rowClass = join(styles.row, eyebrow || detail ? styles.rowTall : styles.rowShort);
  const body = (
    <>
      <span className={styles.rowMain}>
        {eyebrow ? (
          <Hand size="xs" color="inkFaint">
            {eyebrow}
          </Hand>
        ) : null}
        {typeof title === 'string' ? (
          <Hand size="md" bold color={muted ? 'inkSoft' : 'ink'}>
            {title}
          </Hand>
        ) : (
          title
        )}
        {typeof detail === 'string' ? (
          <Hand size="sm" color="inkSoft">
            {detail}
          </Hand>
        ) : (
          detail
        )}
      </span>
      {trailing ? <span className={styles.rowSide}>{trailing}</span> : null}
    </>
  );
  if (onPress) {
    return (
      <button
        type="button"
        aria-label={accessibilityLabel}
        onClick={onPress}
        className={join(rowClass, styles.pressable)}
      >
        {body}
      </button>
    );
  }
  return <div className={rowClass}>{body}</div>;
}

export function List({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>;
}
