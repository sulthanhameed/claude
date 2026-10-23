import { ART, ARM, GEO, HEAD, TORSO, INK } from "./introArt";
import { sparkleAt, type IntroFrame } from "./introTimeline";

/* ─────────────────────────────────────────────────────────────────────────
   The intro is the supplied illustration, traced to vectors, alone on a plain
   white field — no room, no wall, no floor, nothing behind the diner. The
   camera only breathes over it.
   ───────────────────────────────────────────────────────────────────────── */

const GREEN = "#15803d";

interface Props {
  frame: IntroFrame;
  viewBox?: string;
  /** Extra scale applied about the scene centre — phones get a wider fit. */
  fit?: number;
}

/* ── the diner ─────────────────────────────────────────────────────────── */

function Diner({ frame }: Props) {
  const { pose, food } = frame;

  return (
    <g>
      {/* strands of noodles hanging from the bite */}
      {pose.strand > 0.02 && (
        <g opacity={pose.strand} stroke={INK} strokeWidth={4.5} fill="none" strokeLinecap="round">
          <path d={`M${food.x - 6} ${food.y + 9} q-9 26 2 48 q7 14 -1 26`} />
          <path d={`M${food.x + 5} ${food.y + 10} q7 22 -2 42`} />
        </g>
      )}

      {/* torso */}
      {TORSO.map((d, i) => (
        <path key={`t${i}`} d={d} fill={INK} fillRule="evenodd" />
      ))}

      {/* head — the traced silhouette, which already carries the notch where
          the food sits, so the white bite reads as a hole in the shape */}
      <g transform={`translate(0 ${-pose.bob * 0.45}) rotate(${pose.head} ${GEO.head.cx} ${GEO.head.cy})`}>
        {HEAD.map((d, i) => (
          <path key={`h${i}`} d={d} fill={INK} />
        ))}
      </g>

      {/* the eating arm: one rigid cut-out that pivots at the elbow */}
      <g transform={`translate(${pose.armX} ${pose.armY}) rotate(${pose.arm} ${GEO.elbow.x} ${GEO.elbow.y})`}>
        {ARM.map((d, i) => (
          <path key={`a${i}`} d={d} fill={INK} fillRule="evenodd" />
        ))}
      </g>

      {/* satisfaction sparkles */}
      {sparkleAt(frame.ms).amount > 0.01 && (
        <g opacity={sparkleAt(frame.ms).amount} stroke={GREEN} strokeWidth={3} strokeLinecap="round">
          {[
            { x: 340, y: 206, s: 1 },
            { x: 364, y: 238, s: 0.68 },
            { x: 332, y: 250, s: 0.46 },
          ].map((sp, i) => {
            const r = 10 * sp.s;
            const dy = -sparkleAt(frame.ms).t * 10;
            return (
              <g key={i} transform={`translate(${sp.x} ${sp.y + dy})`}>
                <path d={`M${-r} 0 L${r} 0`} opacity={0.9} />
                <path d={`M0 ${-r} L0 ${r}`} opacity={0.9} />
                <path d={`M${-r * 0.55} ${-r * 0.55} L${r * 0.55} ${r * 0.55}`} opacity={0.4} />
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}

/* ── props ─────────────────────────────────────────────────────────────── */

function Bowl() {
  return (
    <g>
      {/* rim, tapered body, little foot — matches the reference silhouette */}
      <path
        d="M57 441.5 H134 Q133.5 458 119 472 Q117 474.5 117 478 V484 H74 V478 Q74 474.5 71 472 Q57 458 57 441.5 Z"
        fill={INK}
      />
      <g stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.92}>
        <path d="M86 434 q-8 -7 -2 -13 q7 -6 1 -13" className="intro-steam intro-steam--a" />
        <path d="M101 432 q-8 -7 -2 -13 q7 -6 1 -13" className="intro-steam intro-steam--b" />
      </g>
    </g>
  );
}

function Mug() {
  return (
    <g>
      <path d="M458 439 C475 440 475 468 458 469" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <rect
        x={413}
        y={425}
        width={44}
        height={57}
        rx={2}
        fill="#ffffff"
        stroke={INK}
        strokeWidth={6}
      />
      <rect x={417.5} y={450.5} width={34} height={26} fill={INK} />
    </g>
  );
}

/* ── scene ─────────────────────────────────────────────────────────────── */

export default function IntroScene({ frame, viewBox = "0 0 1000 600", fit = 1 }: Props) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="intro-svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect x={0} y={0} width={ART.w} height={ART.h} fill="#ffffff" />

      <g transform={fit === 1 ? undefined : `translate(500 300) scale(${fit}) translate(-500 -300)`}>
      <g
        className="intro-world"
        opacity={frame.figureIn}
        transform={`translate(${frame.camera.x} ${frame.camera.y}) scale(${frame.camera.scale})`}
        style={{ willChange: "transform" }}
      >
        <Bowl />
        <Mug />

        {/* the table */}
        <rect x={37} y={493} width={455} height={28} rx={14} fill={INK} />

        <Diner frame={frame} />
      </g>
      </g>
    </svg>
  );
}
