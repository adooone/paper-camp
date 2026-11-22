import { type AnimationEvent, type ReactNode, useEffect, useState } from 'react';
import styles from './sheet.module.css';

interface SheetProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  label?: string;
  chalk?: boolean;
}

// folk-ui's Drawer slides from the side; the phone's sheet rises from the bottom over a fading scrim.
export function Sheet({ visible, onRequestClose, children, label, chalk }: SheetProps) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onRequestClose]);

  if (!mounted) return null;

  const onAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (!visible && event.target === event.currentTarget) setMounted(false);
  };

  return (
    <div className={visible ? styles.overlay : `${styles.overlay} ${styles.closing}`}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className={styles.scrim}
        onClick={onRequestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={chalk ? `${styles.panel} ${styles.chalk}` : styles.panel}
        onAnimationEnd={onAnimationEnd}
      >
        {children}
      </div>
    </div>
  );
}
