import { KNAME, KSUB, KMARK, KUNDERLINE } from "../brand/brandArt";
import { type BrandFrame, brandAt } from "./introBrand";

/* ─────────────────────────────────────────────────────────────────────────
   The brand film: the restaurant's logo and name, as a clip of its own.

   It is a standalone SVG — a separate video that happens to sit over the same
   stage as the entrance. Drop it on white and it plays from nothing to the
   finished identity: the mark lands, "Khang" is written on, the brush follows
   the letters, the eyebrow opens.

   The layout is stacked, the way a storefront reads it: logo above, name under
   it, the kitchen's line at the foot. Each piece is on a line of its own.

   The entrance appends the clip at the end by giving it elapsed time (see
   IntroExperience), and it can play alone at `?intro=brand`.
   ───────────────────────────────────────────────────────────────────────── */

const INK = "#0a0a0a";

/* Where the lockup sits on the 1000 × 600 stage, in stage units. It is stacked
   low — under the drawing, like a signature in the white below the table — so
   the clip can sit over the entrance without ever touching the diner. */
const S = {
  cx: 500,
  markCy: 450,
  markScale: 0.368,
  nameBaseline: 543,
  nameScale: 0.78,
  subBaseline: 583,
  subScale: 0.72,
};

const NAME_TOP = S.nameBaseline - 63.65 * S.nameScale;
const NAME_BOTTOM = S.nameBaseline + 26 * S.nameScale + 6;
const nameX = S.cx - (KNAME.width * S.nameScale) / 2;
const subX = (KSUB.width * S.subScale) / 2;

interface Props {
  /** Playhead inside the clip, in milliseconds. */
  ms: number;
  /** Match the stage's viewBox so the two layers line up exactly. */
  viewBox?: string;
  /** Parent fade — the hand-off to the page. */
  fade?: number;
  /**
   * "lower" tucks the lockup into the white under the drawing, where the
   * appended clip has to live. "center" is the standalone video: the same
   * artwork, larger, in the middle of a blank stage.
   */
  align?: "lower" | "center";
}

/** The middle of the stacked lockup on the stage, in stage units. */
const LOCKUP_CY = 501.5;

export default function IntroBrandTitle({
  ms,
  viewBox = "0 0 1000 600",
  fade = 1,
  align = "lower",
}: Props) {
  const f: BrandFrame = brandAt(ms);
  const started = f.badge > 0 || f.name > 0;

  // the mark settles in with a little overshoot, the way a stamp lands
  const pop = 0.78 + 0.22 * f.badge + Math.sin(f.badge * Math.PI) * 0.06;
  const rise = (1 - f.name) * 10;
  // standalone, the clip is the whole picture: lift the lockup to the middle
  // and give it the room the drawing normally takes
  const frame =
    align === "center"
      ? `translate(500 300) scale(1.5) translate(-500 ${-LOCKUP_CY})`
      : undefined;

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
            y={NAME_TOP - 4}
            width={(KNAME.width * S.nameScale * f.wipe + 2).toFixed(2)}
            height={(NAME_BOTTOM - NAME_TOP + 4).toFixed(2)}
          />
        </clipPath>
      </defs>

      {started && (
        <g transform={frame} className="intro-title" aria-label="Khang Chinese Restaurant and Dimsum">
          {/* the mark — the logo, on its own line */}
          <g
            transform={`translate(${S.cx} ${S.markCy}) scale(${pop.toFixed(3)})`}
            opacity={f.badge}
          >
            <g transform={`scale(${S.markScale}) translate(${-KMARK.size / 2} ${-KMARK.size / 2})`}>
              <g
                fill={INK}
                stroke={INK}
                strokeLinecap="round"
                strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: KMARK.figure.join("") }}
              />
              <circle
                cx={KMARK.size / 2}
                cy={KMARK.size / 2}
                r={KMARK.r}
                fill="none"
                stroke={INK}
                strokeWidth={KMARK.ringWidth}
              />
            </g>
          </g>

          {/* the name — written on by the wipe, with the brush under it */}
          <g transform={`translate(0 ${rise.toFixed(2)})`}>
            <g clipPath="url(#intro-brand-wipe)" opacity={f.name}>
              <g transform={`translate(${nameX.toFixed(2)} ${S.nameBaseline}) scale(${S.nameScale})`}>
                <path d={KNAME.d} fill={INK} />
                <path
                  d={KUNDERLINE}
                  fill="none"
                  stroke={INK}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
              </g>
            </g>
          </g>

          {/* the kitchen's line, opening out from its centre as it arrives */}
          <g
            transform={`translate(${S.cx} ${(S.subBaseline + rise * 0.6).toFixed(2)}) scale(${(
              S.subScale *
              (0.92 + 0.08 * f.sub)
            ).toFixed(3)} ${S.subScale})`}
            opacity={f.sub * 0.62}
          >
            <path d={KSUB.d} transform={`translate(${-subX} 0)`} fill={INK} />
          </g>
        </g>
      )}
    </svg>
  );
}

export { brandAt };
export type { BrandFrame };
