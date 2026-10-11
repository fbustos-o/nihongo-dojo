import { useEffect, useState } from 'react';

/** Height lost to the on-screen keyboard (px) above which we treat it as open. */
export const KEYBOARD_THRESHOLD = 150;

export function isKeyboardOpen(baselineHeight: number, visualHeight: number): boolean {
  return baselineHeight - visualHeight > KEYBOARD_THRESHOLD;
}

/**
 * Detects the virtual keyboard through the visualViewport API and mirrors it on
 * `<html data-keyboard="open">` so CSS can compact layouts and hide the bottom nav.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    // Tallest viewport seen while the keyboard was closed; the layout viewport may shrink too.
    let baseline = Math.max(window.innerHeight, vv.height);
    const onResize = () => {
      const next = isKeyboardOpen(baseline, vv.height);
      if (!next) baseline = Math.max(window.innerHeight, vv.height);
      setOpen(next);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.keyboard = 'open';
    else delete root.dataset.keyboard;
    return () => {
      delete root.dataset.keyboard;
    };
  }, [open]);

  return open;
}
