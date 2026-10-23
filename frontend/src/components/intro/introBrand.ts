/**
 * The brand film — the restaurant's name and logo, as its own short video.
 *
 * It is separate from the entrance on purpose: it has its own timeline and its
 * own page (see BrandFilmPage, at /brand). Nothing here knows about the diner.
 */

/** How long the clip runs, from first frame to the held last frame. */
export const BRAND_DURATION = 2600;

/* ── how the entrance runs the two clips ─────────────────────────────────
   The meal plays first and leaves the stage; the name-and-logo clip follows it
   on the same white stage, as a clip of its own rather than an overlay. */

/** The meal's last beat: the drawing leaves the stage here. */
export const SCENE_END = 5250;

/** How long the drawing takes to dissolve to white. */
export const SCENE_FADE = 450;

/** Where the name-and-logo clip takes over, in entrance milliseconds. */
export const BRAND_START = SCENE_END + SCENE_FADE;

/** How long the finished lockup is held before the page comes in. */
export const BRAND_HOLD = 550;

/** How long the entrance runs, first frame to hand-off. */
export const INTRO_TOTAL = BRAND_START + BRAND_DURATION + BRAND_HOLD;

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
