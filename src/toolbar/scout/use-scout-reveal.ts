import { type FocusEvent, useCallback, useEffect, useRef, useState } from 'react';

const HOVER_INTENT_MS = 120;
const DISMISS_GRACE_MS = 250;

export const useScoutReveal = () => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelOpen = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const reveal = useCallback(() => {
    cancelOpen();
    cancelClose();
    setOpen(true);
  }, [cancelOpen, cancelClose]);

  const dismiss = useCallback(() => {
    cancelOpen();
    cancelClose();
    setOpen(false);
  }, [cancelOpen, cancelClose]);

  const onPointerEnter = useCallback(() => {
    cancelClose();
    if (openTimer.current !== null) return;
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      setOpen(true);
    }, HOVER_INTENT_MS);
  }, [cancelClose]);

  const onPointerLeave = useCallback(() => {
    cancelOpen();
    if (closeTimer.current !== null) return;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, DISMISS_GRACE_MS);
  }, [cancelOpen]);

  const onFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (event.currentTarget.matches(':focus-visible')) reveal();
    },
    [reveal],
  );

  useEffect(() => {
    if (!open) return;
    const onDocumentPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && !event.composedPath().includes(root)) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, dismiss]);

  useEffect(
    () => () => {
      cancelOpen();
      cancelClose();
    },
    [cancelOpen, cancelClose],
  );

  return {
    open,
    rootRef,
    rootProps: { onPointerEnter, onPointerLeave },
    triggerProps: { onClick: reveal, onFocus },
  };
};
