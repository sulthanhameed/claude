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

export default function IntroExperience({ onDone }: Props) {
  const reduced = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Reduced motion: hold the finished restaurant scene instead of animating.
  const [portrait, setPortrait] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 640px) and (orientation: portrait)").matches;
  });
  // Reduced motion opens on the finished still: the clip's last frame, the
  // name and logo sitting complete on white.
  const [ms, setMs] = useState(() => (reduced ? INTRO_TOTAL : 0));
  const [beat, setBeat] = useState<"eat" | "out">(reduced ? "out" : "eat");
  const [leaving, setLeaving] = useState(false);
  const beatRef = useRef(beat);
  const doneRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const frame: IntroFrame = useMemo(() => frameAt(Math.min(ms, SCENE_END)), [ms]);

  const viewBox = portrait ? "250 0 500 604" : "0 0 1000 600";

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

  // Small screens get a taller crop of the scene so the diner stays readable.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px) and (orientation: portrait)");
    const onChange = () => setPortrait(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Lock page scroll behind the overlay.
  useEffect(() => {
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (node && !reduced) {
      // Keep keyboard users inside the intro while it plays.
      node.focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
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
      const capped = Math.min(INTRO_TOTAL, elapsed);
      setMs(capped);
      const nextBeat = capped < BRAND_START ? "eat" : "out";
      if (nextBeat !== beatRef.current) {
        beatRef.current = nextBeat;
        setBeat(nextBeat);
      }
      if (capped < INTRO_TOTAL) {
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
      className="intro-root"
      data-beat={beat}
      data-reduced={reduced ? "true" : "false"}
      style={{
        opacity: leaving ? 0 : 1,
        transition: leaving ? "opacity 440ms ease" : undefined,
        background: "#ffffff",
        pointerEvents: leaving ? "none" : "auto",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Khang introduction"
    >
      <div className="intro-stage" ref={stageRef} tabIndex={-1}>
        {/* the meal, and then its dissolve to white */}
        <IntroScene frame={frame} viewBox={viewBox} opacity={sceneOpacity} />
        {/* the name and logo, as the next clip on the same white stage */}
        <IntroBrandTitle ms={brandMs} viewBox={viewBox} align="center" />
      </div>
    </div>
  );
}
