import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   How the intro's artwork should be cropped on this particular screen.

   The scene is drawn in "artwork units" and shown with one SVG,
   `preserveAspectRatio="xMidYMid meet"` from a fixed viewBox. There are two
   crops of the drawing: 1000×600 for a wide stage, and a tall 500×600 crop
   that keeps the diner and the table readable on a phone.

   Picking between them by `max-width` media query was the bug: a phone lying
   on its side is ~850 px wide, so it never matches a 640 px breakpoint and got
   the wide crop squeezed into a 300 px-tall slot with nothing on either side.
   The crop is chosen here from the stage's own aspect ratio instead, so a
   phone on its side, a foldable, an iPad in split view and an ultrawide all
   land on the right one.

   The wordmark is deliberately not part of this: it is drawn in its own box
   and sized by CSS, so it can never be clipped by the screen edge whichever
   crop the scene is using.
   ───────────────────────────────────────────────────────────────────────── */

export type FitMode = "wide" | "compact" | "tall";

export interface StageFit {
  width: number;
  height: number;
  /** width / height of the stage — rarely needed on its own. */
  ratio: number;
  /** Which crop of the artwork the scene should use. */
  fitMode: FitMode;
  /** True while the stage is wider than it is tall (it is held sideways). */
  landscape: boolean;
}

const LANDSCAPE_CROP = 1000 / 600; // ≈ 1.667
const TALL_CROP = 500 / 604; // ≈ 0.828

/** Everything the layout needs to know, derived from one stage size. */
export function stageFit(width: number, height: number): StageFit {
  // A zero-size stage is what an iframe reports before it is laid out; treat
  // it as a plain laptop rather than dividing by zero.
  const w = width > 0 ? width : 1024;
  const h = height > 0 ? height : 640;
  const ratio = w / h;

  // "wide" once the stage can hold the landscape crop at 80 % or more of its
  // width without the crop becoming a letterbox slot.
  const fitMode: FitMode =
    ratio >= LANDSCAPE_CROP * 0.8 ? "wide" : ratio <= TALL_CROP * 1.15 ? "tall" : "compact";

  return { width: w, height: h, ratio, fitMode, landscape: ratio > 1 };
}

/**
 * Live stage size. Returns a sensible laptop default on the first render so
 * the intro never flashes a foreign crop before the observer reports in.
 */
export function useStageFit(ref: React.RefObject<HTMLElement | null>): StageFit {
  const [size, setSize] = useState(() => ({
    width: typeof window === "undefined" ? 1024 : window.innerWidth || 1024,
    height: typeof window === "undefined" ? 640 : window.innerHeight || 640,
  }));

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    measure();

    // ResizeObserver on the stage: catches the browser chrome sliding away on
    // mobile, the window being dragged, and an iframe resizing — all of which
    // change the stage without firing `resize` on window.
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

  return stageFit(size.width, size.height);
}
