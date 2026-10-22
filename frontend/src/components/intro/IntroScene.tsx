import { memo } from "react";
import { ART, ARM, GEO, HEAD, TORSO, INK } from "./introArt";
import { roomAt, sparkleAt, type IntroFrame } from "./introTimeline";

/* ─────────────────────────────────────────────────────────────────────────
   The scene is the supplied illustration, traced to vectors, in its own
   527 × 581 pixel space. The camera group then scales that artwork up and
   pulls back to reveal a wider 980 × 700 restaurant around it.
   ───────────────────────────────────────────────────────────────────────── */

const GREEN = "#15803d";
const GREEN_DEEP = "#064e2e";
const JADE = "#16a34a";

interface Props {
  frame: IntroFrame;
  viewBox?: string;
}

/* ── the room that grows around the artwork ────────────────────────────── */

const Room = memo(function Room({ wash, decor }: { wash: number; decor: number }) {
  const d = (w: number) => Math.max(0, Math.min(1, decor * 1.3 - w));

  return (
    <g>
      {/* wall + floor */}
      <rect x={-900} y={-900} width={3200} height={2600} fill="url(#intro-room)" opacity={wash} />
      <g opacity={wash}>
        <rect x={-900} y={521} width={3200} height={1400} fill="url(#intro-floor)" />
        <rect x={-900} y={521} width={3200} height={3} fill="#cfe6d9" />
        <g stroke="#cfe7da" strokeWidth={2} opacity={0.28}>
          <line x1={-900} y1={648} x2={2300} y2={648} />
          <line x1={-900} y1={812} x2={2300} y2={812} />
        </g>
      </g>

      {/* wall lattice rhythm */}
      <g opacity={d(0.62)} stroke="#d9ece1" strokeWidth={1.2}>
        {Array.from({ length: 24 }, (_, i) => (
          <line key={i} x1={-70 + i * 62} y1={-60} x2={-70 + i * 62} y2={520} />
        ))}
      </g>

      {/* wainscot */}
      <g opacity={d(0.5)}>
        <rect x={-900} y={404} width={3200} height={2} fill="#cfe6d9" />
        <rect x={-900} y={406} width={3200} height={114} fill="#eef8f2" />
      </g>

      {/* moon gate */}
      <g opacity={d(0.22)}>
        <circle cx={66} cy={214} r={100} fill="#ffffff" stroke={GREEN} strokeWidth={4} />
        <g stroke={GREEN} strokeWidth={2.2} opacity={0.4}>
          <line x1={66} y1={122} x2={66} y2={306} />
          <line x1={-26} y1={214} x2={158} y2={214} />
          <line x1={9} y1={157} x2={123} y2={271} />
          <line x1={123} y1={157} x2={9} y2={271} />
          <circle cx={66} cy={214} r={44} fill="none" />
        </g>
      </g>

      {/* lanterns */}
      <g opacity={d(0.16)}>
        {[
          { x: -150, y: 138, s: 0.8 },
          { x: 330, y: 128, s: 1 },
          { x: 596, y: 152, s: 0.9 },
          { x: 792, y: 106, s: 0.76 },
        ].map((l) => (
          <g key={l.x} transform={`translate(${l.x} ${l.y}) scale(${l.s})`}>
            <line x1={0} y1={-170} x2={0} y2={-34} stroke={GREEN_DEEP} strokeWidth={2.4} opacity={0.55} />
            <ellipse cx={0} cy={0} rx={27} ry={33} fill="#ffffff" stroke={GREEN} strokeWidth={3.5} />
            <g stroke={GREEN} strokeWidth={1.8} opacity={0.5}>
              <line x1={-16} y1={-27} x2={-16} y2={27} />
              <line x1={0} y1={-33} x2={0} y2={33} />
              <line x1={16} y1={-27} x2={16} y2={27} />
            </g>
            <rect x={-9} y={-39} width={18} height={7} rx={2} fill={GREEN_DEEP} />
            <rect x={-9} y={32} width={18} height={7} rx={2} fill={GREEN_DEEP} />
            <path d="M-5 39 L0 56 L5 39" fill={JADE} />
          </g>
        ))}
      </g>

      {/* lattice screens */}
      {[
        { x: -292, y: 158, w: 68, h: 184 },
        { x: 520, y: 138, w: 74, h: 218 },
        { x: 872, y: 118, w: 72, h: 238 },
      ].map((p) => (
        <g key={p.x} opacity={d(0.44)}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={4} fill="#ffffff" stroke={GREEN_DEEP} strokeWidth={3} />
          <g stroke={GREEN} strokeWidth={1.6} opacity={0.32}>
            {[1, 2, 3].map((i) => (
              <line key={`v${i}`} x1={p.x + (p.w / 4) * i} y1={p.y + 8} x2={p.x + (p.w / 4) * i} y2={p.y + p.h - 8} />
            ))}
            {Array.from({ length: 5 }, (_, i) => (
              <line key={`h${i}`} x1={p.x + 8} y1={p.y + 26 + i * 40} x2={p.x + p.w - 8} y2={p.y + 26 + i * 40} />
            ))}
          </g>
        </g>
      ))}

      {/* more crockery down the counter */}
      <g opacity={d(0.38)} transform="translate(886 493)">
        {[0, 1].map((i) => (
          <g key={i} transform={`translate(0 ${-16 * i})`}>
            <rect x={-34} y={-16} width={68} height={16} rx={4} fill="#ffffff" stroke={GREEN_DEEP} strokeWidth={2.6} />
            <line x1={-30} y1={-8} x2={30} y2={-8} stroke="#cfe6d9" strokeWidth={2} />
          </g>
        ))}
      </g>

      <g opacity={d(0.34)} transform="translate(944 493)">
        <path d="M-12 0 v-30 q0 -8 12 -8 q12 0 12 8 v30 z" fill="#ffffff" stroke={GREEN_DEEP} strokeWidth={2.6} />
        <path d="M-6 -33 v-8 q0 -4 6 -4 q6 0 6 4 v8" fill="none" stroke={GREEN_DEEP} strokeWidth={2.4} />
        <ellipse cx={0} cy={-42} rx={7} ry={3} fill={JADE} opacity={0.7} />
      </g>


      {/* the long counter that grows out of the reference table */}
      <g opacity={wash}>
        <ellipse cx={700} cy={534} rx={620} ry={20} fill="#d5eade" opacity={0.7} />
      </g>

      {/* things on the far end of the counter */}
      <g opacity={d(0.34)}>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(536 ${493 - 17 * i})`}>
            <rect x={-38} y={-17} width={76} height={17} rx={4} fill="#ffffff" stroke={GREEN_DEEP} strokeWidth={3} />
            <line x1={-34} y1={-8.5} x2={34} y2={-8.5} stroke="#cfe6d9" strokeWidth={2} />
          </g>
        ))}
        <g transform="translate(536 443)" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.35}>
          <path d="M-16 0 q-7 -12 2 -21" className="intro-steam intro-steam--a" />
          <path d="M4 0 q-7 -12 2 -21" className="intro-steam intro-steam--b" />
        </g>
      </g>

      <g opacity={d(0.42)} transform="translate(668 493)">
        <ellipse cx={0} cy={-4} rx={30} ry={6} fill="#ffffff" stroke={GREEN_DEEP} strokeWidth={2.5} />
        <ellipse cx={0} cy={-5} rx={18} ry={3.4} fill={JADE} opacity={0.5} />
      </g>

      <g opacity={d(0.4)} transform="translate(812 493)">
        <path d="M-32 0 q-4 -42 32 -42 q36 0 32 42 z" fill="#ffffff" stroke={GREEN_DEEP} strokeWidth={3.5} />
        <path d="M32 -27 q26 -5 26 -23" fill="none" stroke={GREEN_DEEP} strokeWidth={4} strokeLinecap="round" />
        <path d="M-32 -23 q-20 -4 -20 -20" fill="none" stroke={GREEN_DEEP} strokeWidth={4} strokeLinecap="round" />
        <rect x={-10} y={-50} width={20} height={9} rx={4} fill={GREEN_DEEP} />
        <g stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.35}>
          <path d="M-6 -55 q-7 -11 2 -19" className="intro-steam intro-steam--b" />
          <path d="M9 -55 q-7 -11 2 -19" className="intro-steam intro-steam--a" />
        </g>
      </g>

    </g>
  );
});

/* ── the diner ─────────────────────────────────────────────────────────── */

function Diner({ frame }: Props) {
  const { pose, food } = frame;

  return (
    <g opacity={frame.figureIn} transform={`translate(0 ${(1 - frame.figureIn) * 8})`}>
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

export default function IntroScene({ frame, viewBox = "0 0 527 581" }: Props) {
  const { wash, decor } = roomAt(frame.ms);

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="intro-svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="intro-room" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="56%" stopColor="#f4fbf7" />
          <stop offset="100%" stopColor="#eaf6ef" />
        </linearGradient>
        <linearGradient id="intro-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8f5ed" />
          <stop offset="100%" stopColor="#d2e9dd" />
        </linearGradient>
      </defs>

      <rect x={0} y={0} width={ART.w} height={ART.h} fill="#ffffff" />

      <g
        className="intro-world"
        data-brand={frame.ms > 4800 ? "true" : "false"}
        transform={`translate(${frame.camera.x} ${frame.camera.y}) scale(${frame.camera.scale})`}
        style={{ willChange: "transform" }}
      >
        <Room wash={wash} decor={decor} />

        <Bowl />
        <Mug />

        {/* the table — it stretches into a long counter as the room arrives */}
        <rect x={37 - wash * 420} y={493} width={455 + wash * 1300} height={28} rx={14} fill={INK} />

        <Diner frame={frame} />
      </g>
    </svg>
  );
}
