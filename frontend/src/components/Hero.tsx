import { useEffect, useMemo, useRef, useState } from "react";
import type { FoodItem } from "../data/menu";
import { useMenu } from "../context/MenuContext";
import { FlameIcon, StarIcon } from "./Icons";
import { ORBIT_MARGIN, ORBIT_MAX, useOrbitFit } from "../hooks/useOrbitScale";

// Fixed position slots — center + 4 around
type Slot = "center" | "tr" | "bl" | "tl" | "br";

/**
 * Pixel-precise positions inside the 460×460 showcase frame.
 * Using top/left so we can transition them smoothly with CSS.
 * Each value is the CENTER of the dish circle.
 */
const SLOT_POS: Record<Slot, { left: number; top: number; size: number; z: number }> = {
  center: { left: 230, top: 230, size: 280, z: 20 },
  tr:     { left: 400, top:  60, size: 110, z: 30 },
  bl:     { left:  60, top: 380, size: 110, z: 30 },
  tl:     { left:  70, top:  85, size:  96, z: 30 },
  br:     { left: 400, top: 400, size:  96, z: 30 },
};

const slotsFromPool = (pool: FoodItem[]): Record<Slot, string> => ({
  center: pool[0]?.id ?? "",
  tr: pool[1]?.id ?? "",
  bl: pool[2]?.id ?? "",
  tl: pool[3]?.id ?? "",
  br: pool[4]?.id ?? "",
});

export default function Hero() {
  const { items } = useMenu();

  // Top 5 featured dishes for the showcase — live from Supabase.
  const pool = useMemo(() => {
    const featured = items.filter((m) => m.featured);
    const base = featured.length >= 5 ? featured : items;
    return [...base].sort((a, b) => b.rating - a.rating).slice(0, 5);
  }, [items]);

  // Store dish IDs per slot so the same DOM node animates between positions.
  const [slotIds, setSlotIds] = useState<Record<Slot, string>>(() =>
    slotsFromPool(pool),
  );
  const [animating, setAnimating] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // The orbit is measured, not guessed: its column width depends on the text
  // beside it and on the container's max-width, so a media query cannot answer.
  const orbitRef = useRef<HTMLDivElement>(null);
  const orbit = useOrbitFit(orbitRef);

  // Re-seat the showcase when the live menu arrives from Supabase.
  useEffect(() => {
    setSlotIds(slotsFromPool(pool));
  }, [pool]);

  // Reverse map: foodId -> slot
  const idToSlot = (id: string): Slot | undefined =>
    (Object.keys(slotIds) as Slot[]).find((s) => slotIds[s] === id);

  const swap = (clicked: Slot) => {
    if (clicked === "center" || animating) return;
    const clickedId = slotIds[clicked];
    if (!clickedId) return;

    setAnimating(true);
    setHighlightId(clickedId);

    // Instantly swap state — but because each dish is keyed by its food id,
    // React re-uses the same DOM node and CSS animates left/top/size.
    setSlotIds((prev) => {
      const next = { ...prev };
      const tmp = next.center;
      next.center = prev[clicked];
      next[clicked] = tmp;
      return next;
    });

    // Lock interactions until the CSS transition finishes
    setTimeout(() => {
      setAnimating(false);
      setHighlightId(null);
    }, 800);
  };

  return (
    <section
      id="home"
      className="relative min-h-screen w-full overflow-hidden bg-white"
    >
      {/* ─── Modern animated gradient mesh background ─── */}
      <div className="absolute inset-0 -z-10 bg-white">
        <div className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[40rem] w-[40rem] rounded-full bg-emerald-300/40 blur-3xl" />
        <div className="absolute left-1/3 top-1/3 h-96 w-96 rounded-full bg-lime-200/30 blur-3xl" />
      </div>

      {/* Dotted grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(6,78,46,0.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Faint Chinese characters */}
      <div className="pointer-events-none absolute left-2 top-1/4 -z-10 hidden font-cn text-[18rem] leading-none text-emerald-900/[0.04] lg:block">
        福
      </div>
      <div className="pointer-events-none absolute right-2 bottom-1/4 -z-10 hidden font-cn text-[18rem] leading-none text-emerald-900/[0.04] lg:block">
        康
      </div>

      {/* ─── Content ─── */}
      {/* From xl up the text and the orbit sit side by side; below that they
          stack. `xl` is 1280 px because that is the first width at which the
          orbit's column is actually wide enough for the composition — the old
          `lg` (1024) left it 406 px for a 450 px shape. Between 640 and 1280
          the orbit is centred under the text at up to 560 px, which is a
          bigger, easier-to-tap version than either column could offer. */}
      <div className="relative mx-auto grid min-h-[100svh] max-w-7xl items-center gap-10 px-4 pb-16 pt-28 sm:px-6 sm:gap-12 lg:px-8 lg:pt-32 xl:grid-cols-[1.02fr_1fr] xl:gap-16 xl:pt-36">
        {/* ─── Left: text content ─── */}
        <div className="relative z-10">
          <div className="inline-flex animate-fade-up items-center gap-3 rounded-full border border-emerald-200 bg-white/70 px-5 py-2 font-mono tracking-eyebrow text-khang-red shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-cn text-sm tracking-[0.15em]">欢迎光临</span>
            <span className="h-3 w-px bg-emerald-300" />
            Now Delivering
          </div>

          <h1 className="mt-6 animate-fade-up delay-100 font-brush tracking-display text-[clamp(2.5rem,7.2vw,5rem)] leading-[1.02] text-khang-ink sm:mt-8">
            Authentic
            <br />
            <span className="italic font-light text-khang-red">Chinese</span>{" "}
            flavors,
            <br />
            <span className="font-display font-light">crafted</span>{" "}
            <span className="font-brush font-medium">fresh.</span>
          </h1>

          <p className="mt-6 max-w-lg animate-fade-up delay-200 font-body text-[15px] font-light leading-[1.75] tracking-wide text-zinc-600 sm:mt-7 sm:text-[17px] sm:leading-[1.85]">
            Hand‑folded dim sum, wok‑tossed noodles &amp; sizzling specialities —
            the soul of Canton &amp; Sichuan, delivered to your door in 30 minutes.
          </p>

          <div className="mt-10 flex animate-fade-up delay-300 flex-wrap items-center gap-4">
            <a
              href="#menu"
              className="group relative overflow-hidden rounded-full bg-khang-ink px-10 py-4 font-display text-[0.95rem] font-semibold uppercase tracking-[0.15em] text-white shadow-[0_10px_40px_rgba(10,10,10,0.25)] transition hover:scale-105 hover:bg-khang-red"
            >
              <span className="relative z-10 flex items-center gap-3">
                Order Now
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </span>
            </a>
            <a
              href="#about"
              className="group inline-flex items-center gap-3 rounded-full border border-khang-ink/15 bg-white/70 px-8 py-3.5 font-display text-[0.95rem] font-medium uppercase tracking-[0.15em] text-khang-ink backdrop-blur-md transition hover:border-khang-red hover:text-khang-red"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 transition group-hover:bg-khang-red group-hover:text-white">
                ▶
              </span>
              Our Story
            </a>
          </div>

          {/* Stats / Trust strip */}
          <div className="mt-12 grid animate-fade-up delay-400 max-w-lg grid-cols-3 gap-6 border-t border-emerald-200/60 pt-8">
            <Stat number="4.6★" label="583 Reviews" />
            <Stat number="10K+" label="Orders / mo" />
            <Stat number="30 min" label="Avg Delivery" />
          </div>

          {/* Hint about interactivity (desktop) */}
          <div className="mt-8 hidden animate-fade-up delay-500 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-khang-ink/50 lg:flex">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Tap any dish on the right to swap it to the centre →
          </div>
        </div>

        {/* ─── The dish orbit ─────────────────────────────────────────────
            One design for every screen, scaled to the space it is given.

            It used to be `hidden lg:block` with hard-coded pixel coordinates
            inside a 460 px frame, so it only appeared at ≥1024 px — and even
            then the column was 406 px wide, 44 px narrower than the drawing.
            An iPad in portrait, a Surface, a half-screen laptop and every
            tablet all fell through to the phone fallback.

            Now the frame is measured (useOrbitFit) and every coordinate is
            multiplied by one factor, so the composition is identical at
            300 px and at 560 px and the flight between slots stays exact.
            ─────────────────────────────────────────────────────────────── */}
        <div
          ref={orbitRef}
          className="relative mx-auto flex w-full items-center justify-center"
          style={{ maxWidth: `min(100%, ${ORBIT_MAX}px)` }}
        >
          {/* The inward frame holds the rings and dishes. It is inset by the
              badge overhang so that the badges, which hang past its edges,
              still land inside the outer box the column was measured for. */}
          <div
            className="relative"
            style={{
              width: orbit.frame,
              height: orbit.frame,
              marginLeft: ORBIT_MARGIN.left * orbit.scale,
            }}
          >
            {/* dashed orbit ring */}
            <div
              className="absolute rounded-full border border-dashed border-emerald-300/60 animate-spin-slow"
              style={{
                left: 0,
                top: 0,
                width: orbit.frame,
                height: orbit.frame,
                animationDuration: "60s",
              }}
            />

            {/* solid inner disc */}
            <div
              className="absolute rounded-full border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white"
              style={{
                left: 60 * orbit.scale,
                top: 60 * orbit.scale,
                width: 340 * orbit.scale,
                height: 340 * orbit.scale,
                boxShadow: `0 ${20 * orbit.scale}px ${60 * orbit.scale}px rgba(6,78,46,0.18)`,
              }}
            />

            {/* steam, rising from the centre dish */}
            {[0, 0.6, 1.2, 1.8].map((delay, i) => (
              <div
                key={`steam-${i}`}
                className="pointer-events-none absolute z-10"
                style={{
                  left: (232 + i * 14) * orbit.scale,
                  top: 96 * orbit.scale,
                  animationDelay: `${delay}s`,
                }}
              >
                <div
                  className="steam rounded-full bg-white/60 blur-sm"
                  style={{ width: 8 * orbit.scale, height: 8 * orbit.scale }}
                />
              </div>
            ))}

            {/* the dishes */}
            {pool.map((item) => {
              const slot = idToSlot(item.id);
              if (!slot) return null;
              const base = SLOT_POS[slot];
              const isCenter = slot === "center";
              const isHighlighted = highlightId === item.id;
              const size = base.size * orbit.scale;

              return (
                <button
                  key={item.id}
                  onClick={() => swap(slot)}
                  disabled={isCenter || animating}
                  aria-label={isCenter ? item.name : `Show ${item.name}`}
                  className={`group absolute -translate-x-1/2 -translate-y-1/2 ${
                    isCenter ? "cursor-default" : "cursor-pointer"
                  }`}
                  style={{
                    left: base.left * orbit.scale,
                    top: base.top * orbit.scale,
                    width: size,
                    height: size,
                    zIndex: isHighlighted ? 50 : base.z,
                    // the flying animation: position and size glide together
                    transition:
                      "left 850ms cubic-bezier(0.34, 1.3, 0.4, 1), " +
                      "top 850ms cubic-bezier(0.34, 1.3, 0.4, 1), " +
                      "width 700ms cubic-bezier(0.22, 1, 0.36, 1), " +
                      "height 700ms cubic-bezier(0.22, 1, 0.36, 1)",
                    willChange: "left, top, width, height",
                  }}
                >
                  <div
                    className={`relative h-full w-full overflow-hidden rounded-full transition-all duration-700 ${
                      isCenter
                        ? "ring-8 ring-white shadow-[0_30px_60px_rgba(6,78,46,0.3)] animate-glow-soft"
                        : "ring-4 ring-white shadow-[0_15px_40px_rgba(6,78,46,0.2)] group-hover:ring-emerald-300 group-hover:shadow-[0_25px_55px_rgba(6,78,46,0.4)]"
                    } ${isHighlighted ? "scale-[1.08]" : ""}`}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className={`h-full w-full object-cover transition-transform duration-700 ${
                        isCenter ? "animate-spin-slow" : "group-hover:scale-110"
                      }`}
                      style={isCenter ? { animationDuration: "50s" } : undefined}
                    />

                    {/* centre-only label */}
                    <div
                      className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent text-center text-white transition-opacity duration-500 ${
                        isCenter ? "opacity-100 delay-200" : "opacity-0"
                      }`}
                      style={{
                        padding: `${10 * orbit.scale}px ${12 * orbit.scale}px`,
                        paddingTop: 40 * orbit.scale,
                      }}
                    >
                      <div
                        className="font-cn tracking-wider text-emerald-200"
                        style={{ fontSize: Math.max(11, 17 * orbit.scale) }}
                      >
                        {item.chineseName}
                      </div>
                      <div
                        className="font-display font-semibold tracking-tight"
                        style={{ fontSize: Math.max(10, 13 * orbit.scale) }}
                      >
                        {item.name}
                      </div>
                      <div
                        className="mt-0.5 inline-flex items-center gap-1.5 font-mono font-semibold tracking-[0.15em] text-emerald-200"
                        style={{ fontSize: Math.max(8, 10 * orbit.scale) }}
                      >
                        <StarIcon
                          style={{ width: 11 * orbit.scale, height: 11 * orbit.scale }}
                        />
                        {item.rating} · ₹{item.price}
                      </div>
                    </div>

                    {/* side-only hover wash */}
                    {!isCenter && (
                      <div className="pointer-events-none absolute inset-0 bg-khang-ink/0 transition duration-300 group-hover:bg-khang-ink/15" />
                    )}

                    {isHighlighted && (
                      <span className="pointer-events-none absolute inset-0 rounded-full ring-4 ring-emerald-400/70 animate-glow-soft" />
                    )}
                  </div>

                        {/* price chip — the satellites sit close together once
                      scaled past this, so the chips go before they collide */}
                  {orbit.scale > 0.72 && (
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-khang-ink font-mono font-semibold text-white shadow-md transition-all duration-500 group-hover:bg-khang-red ${
                        isCenter ? "-bottom-1 opacity-0" : "-bottom-2 opacity-100"
                      }`}
                      style={{
                        padding: `${2 * orbit.scale}px ${10 * orbit.scale}px`,
                        fontSize: Math.max(8, 10 * orbit.scale),
                      }}
                    >
                      ₹{item.price}
                    </div>
                  )}

                  {/* hover tooltip — pointer devices only, so it is never in
                      the way on a tablet */}
                  {!isCenter && (
                    <div
                      className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 font-display font-semibold tracking-tight text-khang-ink opacity-0 shadow-lg ring-1 ring-emerald-100 transition group-hover:opacity-100 lg:block"
                      style={{ bottom: "calc(100% + 8px)", fontSize: 10 }}
                    >
                      {item.name} <span className="text-khang-red">·</span>{" "}
                      <span className="font-mono text-[9px]">tap to swap</span>
                    </div>
                  )}
                </button>
              );
            })}

            {/* "Best Seller" pill. It is the one badge wide enough to collide
                with a satellite dish once the orbit shrinks below a phone, so
                it is the one badge that is dropped — the from-price bubble and
                the fresh badge are round and sit clear of the ring. */}
            {orbit.scale > 0.8 && (
              <div
                className="pointer-events-none absolute z-30 inline-flex animate-drift-x items-center gap-1.5 rounded-full bg-khang-ink font-mono font-semibold uppercase text-white shadow-lg"
                style={{
                  left: orbit.frame / 2,
                  top: -10,
                  transform: "translateX(-50%)",
                  padding: `${6 * orbit.scale}px ${14 * orbit.scale}px`,
                  fontSize: Math.max(8, 10 * orbit.scale),
                  letterSpacing: "0.18em",
                }}
              >
                <FlameIcon
                  className="text-emerald-300"
                  style={{ width: 11 * orbit.scale, height: 11 * orbit.scale }}
                />
                Best Seller
              </div>
            )}

            {/* from-price bubble */}
            <div
              className="pointer-events-none absolute z-30 grid animate-float-soft place-items-center rounded-full bg-gradient-to-br from-khang-red to-khang-red-dark text-white ring-4 ring-white"
              style={{
                right: -6 * orbit.scale,
                bottom: 96 * orbit.scale,
                width: 76 * orbit.scale,
                height: 76 * orbit.scale,
                boxShadow: `0 ${12 * orbit.scale}px ${30 * orbit.scale}px rgba(6,78,46,0.35)`,
                animationDelay: "1.5s",
              }}
            >
              <div className="text-center leading-none">
                <div
                  className="font-mono uppercase text-white/70"
                  style={{
                    fontSize: Math.max(7, 9 * orbit.scale),
                    letterSpacing: "0.12em",
                  }}
                >
                  from
                </div>
                <div
                  className="mt-0.5 font-brush font-semibold"
                  style={{ fontSize: Math.max(11, 19 * orbit.scale) }}
                >
                  ₹160
                </div>
              </div>
            </div>

            {/* rotating "fresh" badge */}
            <div
              className="pointer-events-none absolute z-30 animate-spin-slow"
              style={{
                left: -10 * orbit.scale,
                bottom: 8 * orbit.scale,
                width: 78 * orbit.scale,
                height: 78 * orbit.scale,
                animationDuration: "20s",
              }}
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                <defs>
                  <path
                    id="hero-circle-text"
                    d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
                  />
                </defs>
                <text
                  className="fill-khang-ink font-mono font-semibold uppercase"
                  style={{ fontSize: 11, letterSpacing: "0.3em" }}
                >
                  <textPath href="#hero-circle-text">
                    ✦ Hand-crafted · Fresh daily ·
                  </textPath>
                </text>
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div
                  className="grid place-items-center rounded-full bg-emerald-500 font-brush font-medium text-white"
                  style={{
                    width: 36 * orbit.scale,
                    height: 36 * orbit.scale,
                    fontSize: Math.max(11, 15 * orbit.scale),
                  }}
                >
                  新
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-fade-up delay-500">
        <a
          href="#menu"
          className="flex flex-col items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-khang-ink/50 transition hover:text-khang-red"
        >
          Scroll to explore
          <span className="grid h-8 w-5 place-items-start rounded-full border border-khang-ink/30 p-1">
            <span className="h-1.5 w-1 animate-bounce rounded-full bg-khang-red" />
          </span>
        </a>
      </div>
    </section>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="font-brush text-2xl font-semibold tracking-tight text-khang-ink sm:text-3xl">
        {number}
      </div>
      <div className="mt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </div>
    </div>
  );
}
