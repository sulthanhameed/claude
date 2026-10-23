import { ARM, BOWL, GEO, HEAD, INK, MUG, STEAM, TABLE, TORSO } from "./introArt";
import { type IntroFrame } from "./introTimeline";

/* ─────────────────────────────────────────────────────────────────────────
   The intro is the supplied illustration, alone on a plain white field — no
   room, no wall, no floor, nothing behind the diner.

   The drawing is not redrawn: every contour is lifted from the source image.
   It is only cut into the layers the meal needs — the body (with the socket the
   arm rests in), the head, and the chopping arm, which is hinged at the elbow so
   the chopsticks can dip and come back. The white gaps of the illustration are
   kept exactly where the drawing has them.
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
  const { pose } = frame;
  const bob = pose.bob * 0.9;
  // a lean toward the plate as the chopsticks come up, plus the breath
  const lean = -(pose.bob * 0.45 + pose.arm * 0.07);
  const nod = (pose.head * 0.35).toFixed(2);

  return (
    <g
      transform={`translate(0 ${bob.toFixed(2)}) rotate(${lean.toFixed(2)} 270 470)`}
    >
      <g>
        {TORSO.map((d, i) => (
          <path key={`t${i}`} d={d} {...ink} />
        ))}

        <g transform={pose.head ? `rotate(${nod} ${GEO.head.cx} ${GEO.head.cy})` : undefined}>
          {HEAD.map((d, i) => (
            <path key={`h${i}`} d={d} {...ink} />
          ))}
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
          opacity={frame.figureIn}
          transform={`translate(${frame.camera.x} ${frame.camera.y}) scale(${frame.camera.scale})`}
          style={{ willChange: "transform" }}
        >
          <Props />
          <Diner frame={frame} />
        </g>
      </g>
    </svg>
  );
}
