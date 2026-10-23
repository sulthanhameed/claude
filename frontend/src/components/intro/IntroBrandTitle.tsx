import { INK, KANG, WORDMARK } from "./introArt";
import { type BrandFrame, brandAt } from "./introBrand";

/* ─────────────────────────────────────────────────────────────────────────
   The brand film: the restaurant's logo and name, as a clip of its own.
   It is a standalone SVG — a separate video that happens to sit over the same
   stage as the entrance. Drop it on white and it plays from nothing to the
   finished lockup: the 康 badge lands, "Khang" is written on, the eyebrow opens.
   The entrance appends it at the end by giving it elapsed time (see
   IntroExperience), and it can play alone at `?intro=brand`.
   ───────────────────────────────────────────────────────────────────────── */

const BRAND = "#15803d";
const BRAND_DARK = "#064e2e";

interface Props {
  /** Playhead inside the clip, in milliseconds. */
  ms: number;
  /** Match the stage's viewBox so the two layers line up exactly. */
  viewBox?: string;
  /** Parent fade — the hand-off to the page. */
  fade?: number;
}

export default function IntroBrandTitle({ ms, viewBox = "0 0 1000 600", fade = 1 }: Props) {
  const f: BrandFrame = brandAt(ms);
  const started = f.badge > 0 || f.name > 0;

  // the badge settles in with a little overshoot, the way a logo sting lands
  const pop = 0.74 + 0.26 * f.badge + Math.sin(f.badge * Math.PI) * 0.07;
  const rise = (1 - f.name) * 12;
  const nameX = WORDMARK.centerX - WORDMARK.name.width / 2;

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="intro-brand"
      aria-hidden="true"
      focusable="false"
      style={{ opacity: started ? fade : 0 }}
    >
      <defs>
        {/* the wipe that writes the name on, left to right */}
        <clipPath id="intro-brand-wipe">
          <rect
            x={nameX - 1}
            y={WORDMARK.nameY - 62}
            width={(WORDMARK.name.width * f.wipe + 2).toFixed(2)}
            height={92}
          />
        </clipPath>
      </defs>

      {started && (
        <g className="intro-title" aria-label="Khang Chinese Restaurant and Dimsum">
          {/* the badge — its own line, with the soft shadow of the navbar mark */}
          <g
            transform={`translate(${WORDMARK.centerX} ${WORDMARK.badgeY}) scale(${pop.toFixed(3)})`}
            opacity={f.badge}
          >
            <circle cx={0.5} cy={2.5} r={27} fill={BRAND_DARK} opacity={0.18} />
            <circle r={27} fill={BRAND} />
            <path d={KANG.d} transform={KANG.transform} fill="#ffffff" />
          </g>

          {/* the name — written on by the wipe, on a line of its own */}
          <g transform={`translate(0 ${rise.toFixed(2)})`}>
            <g clipPath="url(#intro-brand-wipe)" opacity={f.name}>
              <path d={WORDMARK.name.d} transform={`translate(${nameX} ${WORDMARK.nameY})`} fill={INK} />
            </g>
          </g>

          {/* the eyebrow, opening out from its centre as it arrives */}
          <g
            transform={`translate(${WORDMARK.centerX} ${WORDMARK.subY + rise * 0.6}) scale(${(0.92 + 0.08 * f.sub).toFixed(3)} 1)`}
            opacity={f.sub * 0.62}
          >
            <path d={WORDMARK.sub.d} transform={`translate(${-WORDMARK.sub.width / 2} 0)`} fill={INK} />
          </g>
        </g>
      )}
    </svg>
  );
}

export { brandAt };
export type { BrandFrame };
