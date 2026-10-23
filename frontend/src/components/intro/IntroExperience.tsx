import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import IntroScene from "./IntroScene";
import {
  INTRO_DURATION,
  INTRO_SEEN_KEY,
  beatAt,
  frameAt,
  type IntroFrame,
} from "./introTimeline";

export function shouldPlayIntro(): boolean {
  if (typeof window === "undefined") return false;
  const param = new URLSearchParams(window.location.search).get("intro");
  if (param === "0") return false;
  if (param === "1") return true;
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
  const [ms, setMs] = useState(() => (reduced ? 5200 : 0));
  const [beat, setBeat] = useState(() => beatAt(reduced ? 5200 : 0));
  const [leaving, setLeaving] = useState(false);
  const beatRef = useRef(beat);
  const doneRef = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const frame: IntroFrame = useMemo(() => frameAt(ms), [ms]);

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
      const elapsed = Math.min(INTRO_DURATION, now - start);
      setMs(elapsed);
      const nextBeat = beatAt(elapsed);
      if (nextBeat !== beatRef.current) {
        beatRef.current = nextBeat;
        setBeat(nextBeat);
      }
      if (elapsed < INTRO_DURATION) {
        handle = raf(tick);
      } else {
        finish();
      }
    };
    handle = raf(tick);
    return () => caf(handle);
  }, [finish, reduced]);

  const exit = reduced && beat !== "out" ? 0 : frame.exit;
  const roomTint = 1 - Math.abs(1 - frame.wash);

  return (
    <div
      className="intro-root"
      data-beat={beat}
      data-reduced={reduced ? "true" : "false"}
      style={{
        opacity: leaving ? 0 : 1 - exit,
        transition: leaving ? "opacity 440ms ease" : undefined,
        background: `radial-gradient(120% 95% at 50% 42%, #ffffff 0%, rgba(238,248,242,${0.55 + 0.45 * roomTint}) 78%, #eaf6ef 100%)`,
        pointerEvents: exit > 0.95 || leaving ? "none" : "auto",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Khang introduction"
    >
      <div className="intro-stage" ref={stageRef} tabIndex={-1}>
        <IntroScene
          frame={frame}
          viewBox={portrait ? "250 96 500 604" : "0 0 1000 600"}
        />
      </div>

      <button
        ref={skipRef}
        type="button"
        className="intro-skip"
        onClick={() => finish()}
      >
        Skip intro
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h13M13 6l6 6-6 6" />
        </svg>
      </button>

      {!reduced && (
        <div className="intro-progress" aria-hidden="true">
          <span style={{ animationDuration: `${INTRO_DURATION}ms` }} />
        </div>
      )}
    </div>
  );
}
