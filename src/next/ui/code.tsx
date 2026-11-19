import type { ReactNode } from 'react';
import styles from './code.module.css';

interface CodeProps {
  children: ReactNode;
}

// folk-ui's InlineCode is a bordered chip; the phone's Code is an unboxed mono run on an elevated fill.
export function Code({ children }: CodeProps) {
  return <code className={styles.code}>{children}</code>;
}
