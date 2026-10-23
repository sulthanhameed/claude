import {
  ARM,
  BOWL,
  GEO,
  HEAD,
  INK,
  KANG,
  MOUTH,
  MOUTH_C,
  MUG,
  STEAM,
  TABLE,
  TORSO,
  WORDMARK,
} from "./introArt";
import { type IntroFrame } from "./introTimeline";

/* ─────────────────────────────────────────────────────────────────────────
   The intro is the supplied illustration, alone on a plain white field — no
   room, no wall, no floor, nothing behind the diner.

   The drawing is not redrawn: every contour is lifted from the source image.
   The meal is played by closing the mouth the drawing already has (an ink lid
   over the opening, clipped to the jaw) and by the figure's breath, lean and
   nod — so the silhouette stays exactly the artwork on every frame.
   ───────────────────────────────────────────────────────────────────────── */

interface Props {
  frame: IntroFrame;
  viewBox?: string;
  /** Extra scale applied about the scene centre — phones get a wider fit. */
  fit?: number;
}

const ink = { fill: INK, fillRule: "evenodd" as const };

/* ── the diner ─────────────────────────────────────────────────────────── */

function Diner({ frame }: Props) {
  const { pose, motion } = frame;
  const bob = pose.bob * 0.9;
  const { lean, nod, breath } = motion;

  // The mouth in the drawing is an opening in the head's own outline, so the
  // meal is played by working the head: it opens a touch as the bite arrives
  // and squeezes down on the chew. The hole travels with the jaw, exactly the
  // way it would if the drawing were being animated by hand.
  const open = Math.max(0, pose.mouth - 1) * 0.9; // 0…0.4, the opening widens
  const bite = Math.max(0, 1 - pose.mouth); //      0…0.4, the jaw compresses

  return (
    <g
      transform={[
        `translate(0 ${bob.toFixed(2)})`,
        "translate(270 470)",
        `rotate(${lean.toFixed(2)})`,
        `scale(${breath.toFixed(4)})`,
        "translate(-270 -470)",
      ].join(" ")}
    >
      <g>
        {TORSO.map((d, i) => (
          <path key={`t${i}`} d={d} {...ink} />
        ))}

        <g
          transform={[
            `rotate(${nod.toFixed(2)} ${GEO.head.cx} ${GEO.head.cy})`,
            `translate(${GEO.head.cx} 334)`,
            `scale(${(1 + bite * 0.055).toFixed(4)} ${(1 - bite * 0.075).toFixed(4)})`,
            `translate(${-GEO.head.cx} -334)`,
          ].join(" ")}
        >
          {HEAD.map((d, i) => (
            <path key={`h${i}`} d={d} {...ink} />
          ))}

          {/* the opening widens as the bite comes in… */}
          {open > 0.002 && (
            <path
              d={MOUTH}
              fill="#ffffff"
              transform={[
                `translate(${MOUTH_C.x} ${MOUTH_C.y})`,
                `scale(${(1 + open).toFixed(3)} ${(1 + open * 0.7).toFixed(3)})`,
                `translate(${-MOUTH_C.x} ${-MOUTH_C.y})`,
              ].join(" ")}
            />
          )}
        </g>

        {/* the hand rests where the drawing puts it — at the mouth */}
        {ARM.map((d, i) => (
          <path key={`a${i}`} d={d} {...ink} />
        ))}
      </g>
    </g>
  );
}

/* ── props ─────────────────────────────────────────────────────────────── */

function Props() {
  return (
    <g>
      {BOWL.map((d, i) => (
        <path key={`b${i}`} d={d} {...ink} />
      ))}
      {STEAM.map((d, i) => (
        <path key={`s${i}`} d={d} {...ink} className={`intro-steam intro-steam--${i === 0 ? "a" : "b"}`} />
      ))}
      {MUG.map((d, i) => (
        <path key={`m${i}`} d={d} {...ink} />
      ))}
      {TABLE.map((d, i) => (
        <path key={`w${i}`} d={d} {...ink} />
      ))}
    </g>
  );
}

/* ── the wordmark ─────────────────────────────────────────────────────────
   The restaurant's own lockup, the one in the navbar: the 康 badge in brand
   green, "Khang" set in Playfair, and the "Chinese · Dimsum" line under it. It
   rises out of the white once the drawing has settled, and the intro hands the
   page over on it.
   ───────────────────────────────────────────────────────────────────────── */

const BRAND = "#15803d";
const BRAND_DARK = "#064e2e";

function Wordmark({ frame }: Props) {
  const { badge, name, sub } = frame.title;
  if (badge <= 0) return null;

  // the badge lands with a small overshoot; the type rises into place
  const pop = 0.78 + 0.22 * badge + Math.sin(badge * Math.PI) * 0.06;
  const rise = (1 - name) * 10;

  return (
    <g className="intro-title" aria-label="Khang Chinese Restaurant and Dimsum">
      {/* the badge — its own line, with the soft shadow the navbar mark carries */}
      <g
        transform={`translate(${WORDMARK.centerX} ${WORDMARK.badgeY}) scale(${pop.toFixed(3)})`}
        opacity={badge}
      >
        <circle cx={0.5} cy={2.5} r={27} fill={BRAND_DARK} opacity={0.18} />
        <circle r={27} fill={BRAND} />
        <path d={KANG.d} transform={KANG.transform} fill="#ffffff" />
      </g>

      {/* the name — centred on its own line */}
      <g
        transform={`translate(${(WORDMARK.centerX - WORDMARK.name.width / 2).toFixed(2)} ${(WORDMARK.nameY + rise).toFixed(2)})`}
        opacity={name}
      >
        <path d={WORDMARK.name.d} fill={INK} />
      </g>

      {/* the eyebrow, centred under the name and opening out as it fades in */}
      <g
        transform={`translate(${(WORDMARK.centerX - WORDMARK.sub.width / 2).toFixed(2)} ${(WORDMARK.subY + rise * 0.6).toFixed(2)})`}
        opacity={sub * 0.62}
      >
        <path d={WORDMARK.sub.d} fill={INK} />
      </g>
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
      <rect x={-2000} y={-2000} width={6000} height={6000} fill="#ffffff" />

      <g transform={fit === 1 ? undefined : `translate(500 300) scale(${fit}) translate(-500 -300)`}>
        <g
          className="intro-world"
          opacity={frame.figureIn * frame.motion.ink}
          transform={`translate(${frame.camera.x} ${frame.camera.y}) scale(${frame.camera.scale})`}
          style={{ willChange: "transform, opacity" }}
        >
          <Props />
          <Diner frame={frame} />
        </g>

        {/* the lockup sits still on screen while the drawing settles behind it */}
        <g opacity={1 - frame.exit}>
          <Wordmark frame={frame} />
        </g>
      </g>
    </svg>
  );
}
