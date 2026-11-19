import type { ElementType, ReactNode } from 'react';
import styles from './hand.module.css';
import type { TextSize } from './tokens';

export type FontRole = 'serif' | 'hand' | 'mono' | 'display';

export type HandColor =
  | 'ink'
  | 'inkSoft'
  | 'inkFaint'
  | 'sketchInk'
  | 'canvas700'
  | 'danger'
  | 'good';

interface HandProps {
  children: ReactNode;
  bold?: boolean;
  size?: TextSize;
  font?: FontRole;
  color?: HandColor;
  numberOfLines?: number;
  as?: ElementType;
  className?: string;
}

const sizeClass = (size: TextSize): string => (size === '2xl' ? styles.size2xl : styles[size]);

export function Hand({
  children,
  bold,
  size = 'base',
  font = 'serif',
  color = 'ink',
  numberOfLines,
  as: Element = 'span',
  className,
}: HandProps) {
  const classes = [
    styles.text,
    styles[font],
    sizeClass(size),
    styles[color],
    bold && styles.bold,
    numberOfLines && styles.clamp,
    className,
  ];
  return (
    <Element
      className={classes.filter(Boolean).join(' ')}
      style={numberOfLines ? { WebkitLineClamp: numberOfLines } : undefined}
    >
      {children}
    </Element>
  );
}
