import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   Scales the hero's dish orbit to whatever room it actually has.

   The orbit is drawn inside a 460 × 460 frame with hand-placed coordinates:
   the centre dish is 280 units across and the four satellites sit on a ring
   around it. Those numbers used to be raw pixels, which only works at one
   width — and `hidden lg:block` meant every screen narrower than 1024 px got
   the phone fallback instead: an iPad in portrait, a Surface, a laptop with
   the window dragged to half. At exactly 1024 px the right-hand column was
   406 px, so even the "desktop" layout overflowed by 44 px.

   Two things have to be true for the box to fit its column:

     1. the frame is scaled as one piece, so every proportion holds and the
        animation between slots stays exact at any size;
     2. the badges that hang outside the frame are counted. The from-price
        bubble sits 6 units past the right edge and the fresh badge 10 past the
        left, and the best-seller pill 10 above the top — 16 units in all. Left
        out of the maths they push a scaled orbit ~19 px past its column, which
        is exactly what the first version of this hook did.
   ───────────────────────────────────────────────────────────────────────── */

/** The frame the slot coordinates are authored in. */
export const ORBIT_BASE = 460;

/** Space the badges take outside that frame: 10 left + 6 right, 10 top. */
export const ORBIT_MARGIN = { left: 10, right: 6, top: 10 } as const;

/** The frame plus its badges — what actually has to fit. */
export const ORBIT_OUTER = ORBIT_BASE + ORBIT_MARGIN.left + ORBIT_MARGIN.right;

/** Widest the whole composition is allowed to get. */
export const ORBIT_MAX = 560;

/** Densest it is allowed to get before it stops being tappable. */
const MIN_FRAME = 220;

/**
 * The scale factor for an available width.
 *
 * `available` is the width of the box the orbit will live in, badges included.
 * There is no arbitrary floor: on a 280 px foldable the column is ~248 px and
 * the orbit simply gets smaller, rather than overflowing because a constant
 * said it should not. `MIN_FRAME` only guards against a zero-width container.
 */
export function orbitScale(available: number): number {
  if (!Number.isFinite(available) || available <= 0) return 1;
  const capped = Math.min(available, ORBIT_MAX);
  const scale = capped / ORBIT_OUTER;
  return Math.max(MIN_FRAME / ORBIT_BASE, scale);
}

export interface OrbitFit {
  /** Outer box that must fit the column, in px. */
  size: number;
  /** The inward frame containing the rings and dishes, in px. */
  frame: number;
  /** Same value as a scale factor against ORBIT_BASE. */
  scale: number;
  /** The measured width of the space it was given. */
  available: number;
}

/**
 * Measures a container and returns the orbit size that fits it.
 *
 * A ResizeObserver is used rather than a media query because the orbit lives
 * in a grid column whose width depends on the text beside it, the container's
 * max-width and the padding — not on the window alone. Watching the element
 * gets the right answer in all three cases, including the one that broke:
 * a window resized in place.
 */
export function useOrbitFit(ref: React.RefObject<HTMLElement | null>): OrbitFit {
  const [available, setAvailable] = useState(() => {
    if (typeof window === "undefined") return ORBIT_OUTER;
    return Math.min(window.innerWidth, 1152);
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      const width = node.getBoundingClientRect().width;
      if (width > 0) setAvailable(width);
    };

    measure();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(measure);
      observer.observe(node);
    }
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [ref]);

  const scale = orbitScale(available);
  return {
    size: Math.round(ORBIT_OUTER * scale),
    frame: Math.round(ORBIT_BASE * scale),
    scale,
    available,
  };
}
