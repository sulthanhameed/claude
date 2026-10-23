/**
 * The brand film — the restaurant's name and logo, as its own short video.
 *
 * It is separate from the entrance on purpose: it has its own timeline and its
 * own page (see BrandFilmPage, at /brand). Nothing here knows about the diner.
 */

/** How long the clip runs, from first frame to the held last frame. */
export const BRAND_DURATION = 2600;

/** Where the clip joins the entrance, in entrance milliseconds — the moment
 *  the meal settles and the drawing leaves the frame to the name and logo. */
export const BRAND_START = 3800;

export interface BrandFrame {
  /** Playhead inside the clip, 0…BRAND_DURATION. */
  ms: number;
  /** 0…1 the badge lands. */
  badge: number;
  /** 0…1 the name is written on. */
  name: number;
  /** 0…1 how far the name wipe has travelled. */
  wipe: number;
  /** 0…1 the eyebrow underneath. */
  sub: number;
  /** True once the clip has played out. */
  done: boolean;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const range = (ms: number, from: number, to: number) => clamp((ms - from) / (to - from));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function brandAt(ms: number): BrandFrame {
  const t = clamp(ms, 0, BRAND_DURATION);
  return {
    ms: t,
    // the badge drops in first and settles with a small overshoot
    badge: easeOut(range(t, 0, 360)),
    // the name is written on from the left
    name: easeOut(range(t, 260, 520)),
    wipe: easeInOut(range(t, 260, 820)),
    // the eyebrow opens out under it
    sub: easeOut(range(t, 700, 1120)),
    done: t >= BRAND_DURATION - 1,
  };
}
