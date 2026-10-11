import { useEffect, type RefObject } from 'react';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * While an input inside `container` has focus, keep it (and the optional `anchor`, e.g. the active
 * prompt) in the visible area. Re-runs when the virtual keyboard finishes resizing the viewport.
 */
export function useKeepInView(container: RefObject<HTMLElement | null>, anchor?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    let timer: number | undefined;
    const behavior: ScrollBehavior = reducedMotion() ? 'auto' : 'smooth';
    const focused = () => (document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : null);
    const reveal = () => {
      const el = focused();
      if (!el) return;
      // Prompt first so the input (the thing being typed in) ends up centred.
      anchor?.current?.scrollIntoView?.({ block: 'nearest', behavior });
      el.scrollIntoView?.({ block: 'center', behavior });
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(reveal, 250);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        reveal();
        schedule();
      }
    };
    root.addEventListener('focusin', onFocusIn);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', schedule);
    if (focused()) schedule();
    return () => {
      window.clearTimeout(timer);
      root.removeEventListener('focusin', onFocusIn);
      vv?.removeEventListener('resize', schedule);
    };
  }, [container, anchor]);
}
