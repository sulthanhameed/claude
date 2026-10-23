import { ARM, BOWL, HEAD, INK, MUG, STEAM, TABLE, TORSO } from "./introArt";
import { type IntroFrame } from "./introTimeline";

/* ─────────────────────────────────────────────────────────────────────────
   The intro is the supplied illustration, traced contour for contour, alone on
   a plain white field — no room, no wall, no floor, nothing behind the diner.
   Nothing is redrawn: the scene on screen is the drawing itself, and the only
   motion is the camera move plus a breath in the figure and the steam.
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
  const bob = frame.pose.bob * 0.5;

  return (
    <g transform={bob ? `translate(0 ${bob.toFixed(2)})` : undefined}>
      {TORSO.map((d, i) => (
        <path key={`t${i}`} d={d} {...ink} />
      ))}
      {HEAD.map((d, i) => (
        <path key={`h${i}`} d={d} {...ink} />
      ))}
      {ARM.map((d, i) => (
        <path key={`a${i}`} d={d} {...ink} />
      ))}
    </g>
  );
}

/* ── props ─────────────────────────────────────────────────────────────── */

function Bowl() {
  return (
    <g>
      {BOWL.map((d, i) => (
        <path key={`b${i}`} d={d} {...ink} />
      ))}
      {STEAM.map((d, i) => (
        <path key={`s${i}`} d={d} {...ink} className={`intro-steam intro-steam--${i === 0 ? "a" : "b"}`} />
      ))}
    </g>
  );
}

function Mug() {
  return (
    <g>
      {MUG.map((d, i) => (
        <path key={`m${i}`} d={d} {...ink} />
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
          <Bowl />
          <Mug />
          {TABLE.map((d, i) => (
            <path key={`w${i}`} d={d} {...ink} />
          ))}
          <Diner frame={frame} />
        </g>
      </g>
    </svg>
  );
}
