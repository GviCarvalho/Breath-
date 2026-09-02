// Lightweight FLIP (First-Last-Invert-Play) utilities for React lists
// Usage: const { setRef } = useFlipList(ids); attach ref={setRef(id)} to each tile wrapper.

import * as React from 'react';

type Id = string | number;

export type FlipOptions = {
  // Duration of the animation in ms
  duration?: number;
  // Easing function for the animation
  easing?: string;
  // Whether to include scale in the FLIP transform (default true)
  scale?: boolean;
  // Allow consumers to disable based on external state
  disabled?: boolean;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function measure(el: HTMLElement): DOMRect {
  // Use getBoundingClientRect for layout bounds relative to viewport
  return el.getBoundingClientRect();
}

function playFlip(el: HTMLElement, first: DOMRect, last: DOMRect, opts?: FlipOptions) {
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sw = first.width / (last.width || 1);
  const sh = first.height / (last.height || 1);

  const needTranslate = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
  const needScale = (opts?.scale ?? true) && (Math.abs(sw - 1) > 0.01 || Math.abs(sh - 1) > 0.01);

  if (!needTranslate && !needScale) return;

  const transformFrom = `translate(${dx}px, ${dy}px)${needScale ? ` scale(${sw}, ${sh})` : ''}`;

  try {
    el.animate(
      [
        { transformOrigin: 'top left', transform: transformFrom },
        { transformOrigin: 'top left', transform: 'none' },
      ],
      {
        duration: opts?.duration ?? 300,
        easing: opts?.easing ?? 'cubic-bezier(.2,.9,.3,1)',
        fill: 'both',
      }
    );
  } catch {
    // Fallback: set the initial transform and clear it on next frame
    const prev = el.style.transform;
    el.style.transformOrigin = 'top left';
    el.style.transform = transformFrom;
    requestAnimationFrame(() => {
      el.style.transform = prev || '';
    });
  }
}

/**
 * useFlipList animates a list of elements between renders when their positions change.
 * Provide a stable ordered list of ids and attach setRef(id) to each element wrapper.
 */
export function useFlipList(ids: Id[], options?: FlipOptions) {
  const elsRef = React.useRef(new Map<Id, HTMLElement>());
  const prevRectsRef = React.useRef<Map<Id, DOMRect> | null>(null);
  const reduced = prefersReducedMotion();

  const setRef = React.useCallback(
    (id: Id) => (el: HTMLElement | null) => {
      if (el) elsRef.current.set(id, el);
      else elsRef.current.delete(id);
    },
    []
  );

  // Build a stable dependency key for the current order; consumers can pass a custom key if needed
  const orderKey = React.useMemo(() => ids.join('|'), [ids]);

  React.useLayoutEffect(() => {
    if (options?.disabled || reduced) {
      // Still update the prev rects so when re-enabled we have a baseline
      const rects = new Map<Id, DOMRect>();
      ids.forEach((id) => {
        const el = elsRef.current.get(id);
        if (el) rects.set(id, measure(el));
      });
      prevRectsRef.current = rects;
      return;
    }

    const prevRects = prevRectsRef.current;
    const nextRects = new Map<Id, DOMRect>();
    ids.forEach((id) => {
      const el = elsRef.current.get(id);
      if (el) nextRects.set(id, measure(el));
    });

    if (prevRects && prevRects.size) {
      // Play animations for elements that existed in previous render
      ids.forEach((id) => {
        const el = elsRef.current.get(id);
        const first = prevRects.get(id);
        const last = nextRects.get(id);
        if (!el || !first || !last) return;
        playFlip(el, first, last, options);
      });
    }

    // Update for the next render
    prevRectsRef.current = nextRects;
    // Cleanup on unmount
    return () => {
      prevRectsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, options?.duration, options?.easing, options?.scale, options?.disabled, reduced]);

  return { setRef } as const;
}

/**
 * Imperative FLIP for a single element: call before and after you change layout.
 */
export function flipOnce(el: HTMLElement, doLayoutChange: () => void, options?: FlipOptions) {
  if (!el) return;
  const first = measure(el);
  doLayoutChange();
  // Wait for DOM to apply the change before measuring last
  requestAnimationFrame(() => {
    const last = measure(el);
    playFlip(el, first, last, options);
  });
}
