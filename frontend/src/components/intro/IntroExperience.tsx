import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import IntroBrandTitle from "./IntroBrandTitle";
import IntroScene from "./IntroScene";
import {
  BRAND_DURATION,
  BRAND_START,
  INTRO_TOTAL,
  SCENE_END,
  SCENE_FADE,
} from "./introBrand";
import { INTRO_SEEN_KEY, frameAt, smoothstep, type IntroFrame } from "./introTimeline";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useStageFit } from "../../hooks/useStageFit";

export function shouldPlayIntro(): boolean {
  if (typeof window === "undefined") return false;
  const param = new URLSearchParams(window.location.search).get("intro");
  if (param === "0") return false;
  if (param === "1") return true;
  // the brand film lives on its own page (see BrandFilmPage)
  if (param === "brand") return false;
  // While the site is being built the intro should be reviewable on every reload.
  if (import.meta.env?.DEV) return true;
  try {
    if (window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1") return false;
  } catch {
    /* private mode — play it, nothing to remember */
  }
  return true;
}

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface Props {
  onDone: () => void;
}

/**
 * How long to hold this page, on this screen. The wordmark needs roughly a
 * second and a half after the scene has dissolved to land, and a phone propped
 * in landscape is the tightest case there is — so the hold is expressed in the
 * units the viewer actually has (time), not in pixels.
 */
const HOLD_FLOOR = 1400;

export default function IntroExperience({ onDone }: Props) {
  const reduced = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneBoxRef = useRef<HTMLDivElement>(null);
  const fit = useStageFit(sceneBoxRef);

  // Reduced motion opens on the finished still: the clip's last frame, the
  // name and logo sitting complete on white.
  const [ms, setMs] = useState(() => (reduced ? INTRO_TOTAL : 0));
  const [beat, setBeat] = useState<"eat" | "out">(reduced ? "out" : "eat");
  const [leaving, setLeaving] = useState(false);
  const beatRef = useRef(beat);
  const doneRef = useRef(false);

  const frame: IntroFrame = useMemo(() => frameAt(Math.min(ms, SCENE_END)), [ms]);

  // Which crop of the artwork to use. The scene is the only layer that needs
  // one — the lockup is drawn in its own box and is sized by CSS — so this is
  // simply "the tall crop on a phone standing up, the wide one everywhere else".
  const viewBox = fit.fitMode === "tall" ? "250 0 500 600" : "0 0 1000 600";

  // Two clips, one after the other: the meal plays, the drawing dissolves, and
  // then the name-and-logo clip — the one /brand plays alone — has the stage.
  const brandMs = Math.min(BRAND_DURATION, Math.max(0, ms - BRAND_START));
  const sceneOpacity = 1 - smoothstep(ms, SCENE_END, SCENE_END + SCENE_FADE);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    markIntroSeen();
    setLeaving(true);
    setBeat("out");
    // Let the CSS fade cover the hand-off to the homepage.
    window.setTimeout(onDone, 460);
  }, [onDone]);

  // Remember immediately so a refresh mid-intro doesn't replay it.
  useEffect(() => {
    markIntroSeen();
  }, []);

  // Lock page scroll behind the overlay (shared counter, so it composes with
  // any dialog that opens later).
  useBodyScrollLock(true);

  useEffect(() => {
    const node = rootRef.current;
    if (node && !reduced) {
      // Keep keyboard users inside the intro while it plays.
      node.focus({ preventScroll: true });
    }
    // Escape (and Enter/Space, for a remote or a keyboard without Esc) leaves
    // the intro — the same gesture as before, now also reachable on a device
    // that has no pointer.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, reduced]);

  // Main clock.
  useEffect(() => {
    if (reduced) {
      const t = window.setTimeout(() => finish(), 1500);
      return () => window.clearTimeout(t);
    }

    // Prefer the host's rAF; fall back to timers in non-visual environments.
    const raf =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16);
    const caf =
      typeof window.cancelAnimationFrame === "function"
        ? window.cancelAnimationFrame.bind(window)
        : window.clearTimeout.bind(window);

    let handle = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      const capped = Math.min(INTRO_TOTAL + HOLD_FLOOR, elapsed);
      setMs(Math.min(INTRO_TOTAL, capped));
      const nextBeat = capped < BRAND_START ? "eat" : "out";
      if (nextBeat !== beatRef.current) {
        beatRef.current = nextBeat;
        setBeat(nextBeat);
      }
      if (capped < INTRO_TOTAL + HOLD_FLOOR) {
        handle = raf(tick);
      } else {
        finish();
      }
    };
    handle = raf(tick);
    return () => caf(handle);
  }, [finish, reduced]);

  return (
    <div
      ref={rootRef}
      className="intro-root"
      data-beat={beat}
      data-fit={fit.fitMode}
      data-reduced={reduced ? "true" : "false"}
      data-landscape={fit.landscape ? "true" : "false"}
      style={{
        opacity: leaving ? 0 : 1,
        transition: leaving ? "opacity 440ms ease" : undefined,
        background: "#ffffff",
        pointerEvents: leaving ? "none" : "auto",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Khang introduction"
      tabIndex={-1}
    >
      <div className="intro-stage" ref={stageRef}>
        <div className="intro-scene" ref={sceneBoxRef}>
          {/* the meal, and then its dissolve to white */}
          <IntroScene frame={frame} viewBox={viewBox} opacity={sceneOpacity} />
        </div>

        {/* The name and logo, as the second clip. It starts once the scene has
            finished dissolving — the two never share the stage — so it gets the
            whole screen, and CSS sizes it from the screen rather than from the
            artwork's wide crop. That is what keeps it readable on a phone held
            sideways and on an ultrawide monitor alike. */}
        <div className="intro-lockup" aria-hidden="true">
          <IntroBrandTitle ms={brandMs} align="center" />
        </div>
      </div>
    </div>
  );
}
