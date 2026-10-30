import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import IntroBrandTitle from "../components/intro/IntroBrandTitle";
import { BRAND_DURATION } from "../components/intro/introBrand";

/* ─────────────────────────────────────────────────────────────────────────
   The brand film's own page.

   The name-and-logo clip used to ride on the end of the entrance; it lives
   here now, on a white page of its own, the way a film plays in a room by
   itself. The clip plays once and holds its last frame; Replay runs it again.
   ───────────────────────────────────────────────────────────────────────── */

export default function BrandFilmPage() {
  const reduced = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const [portrait, setPortrait] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 640px) and (orientation: portrait)").matches;
  });

  // reduced motion: the film is a still, so it opens on its last frame
  const [ms, setMs] = useState(() => (reduced ? BRAND_DURATION : 0));
  const [done, setDone] = useState(reduced);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  const play = useCallback(() => {
    if (typeof window === "undefined") return;
    window.cancelAnimationFrame(rafRef.current);
    if (reduced) {
      setMs(BRAND_DURATION);
      setDone(true);
      return;
    }
    setMs(0);
    setDone(false);
    startRef.current = 0;
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const t = Math.min(BRAND_DURATION, now - startRef.current);
      setMs(t);
      if (t < BRAND_DURATION) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    rafRef.current = window.requestAnimationFrame(tick);
  }, [reduced]);

  useEffect(() => {
    const previous = document.title;
    document.title = "Khang · brand film";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    play();
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [play]);

  // Small screens get the same taller crop the entrance uses.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px) and (orientation: portrait)");
    const onChange = () => setPortrait(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const viewBox = portrait ? "250 0 500 604" : "0 0 1000 600";

  return (
    <main className="fixed inset-0 grid place-items-center overflow-hidden bg-white">
      <h1 className="sr-only">Khang Chinese Restaurant &amp; Dimsum — brand film</h1>

      <div className="brand-film-stage" data-portrait={portrait ? "true" : "false"}>
        <IntroBrandTitle ms={ms} viewBox={viewBox} align="center" />
      </div>

      {/* the controls arrive with the last frame, never over the film itself */}
      <div
        className="fixed inset-x-0 flex items-center justify-center gap-6 px-6 transition-opacity duration-500"
        style={{
          bottom: "max(24px, env(safe-area-inset-bottom))",
          opacity: done ? 1 : 0,
          pointerEvents: done ? "auto" : "none",
        }}
      >
        <button
          type="button"
          onClick={play}
          className="rounded-full border border-neutral-300 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-600 transition hover:border-neutral-900 hover:text-neutral-900"
        >
          Replay
        </button>
        <a
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-400 transition hover:text-neutral-900"
        >
          Enter the restaurant →
        </a>
      </div>
    </main>
  );
}
