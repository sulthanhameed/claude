import { KNAME, KSUB, KMARK, KUNDERLINE } from "./brandArt";

/* ─────────────────────────────────────────────────────────────────────────
   The Khang identity — the logo and the name as a stick man.

   The mark is the diner: the same figure the entrance draws, sitting behind
   the table line inside a hand-drawn ring. The name is hand-lettered, with a
   brush underline, and "CHINESE · DIMSUM" in marker caps underneath.

   Each piece stands on its own:

     <KhangMark />   the logo, alone — favicon, app icon, stamp
     <KhangName />   the restaurant name, alone — signage, letterhead
     <KhangLogo />   the two together, the way they are used in a header

   Everything is outlined geometry: no webfonts, no images, no CJK font. It
   renders identically everywhere and stays legible down to a favicon.
   ───────────────────────────────────────────────────────────────────────── */

const INK = "#0a0a0a";

/* The approved identity sheet, in its own units. The mark's circle sits at
   (152, 168) with r = 76; the name's baseline is at (260, 184); the eyebrow's
   baseline is at (268, 238). The lockup canvas is the ink's bounding box plus
   a little air, measured from that sheet. */
const SHEET = {
  x: 66,
  y: 82,
  w: 424,
  h: 172,
  markCx: 152,
  markCy: 168,
  nameX: 260,
  nameY: 184,
  subX: 268,
  subY: 238,
  underlineWidth: 6,
};

/* The name on its own: x 260 → 486, y −64 → +63 relative to the baseline. */
const NAME_BOX = { w: 227, top: -64, h: 127 };

type MarkProps = {
  /** Diameter in px. */
  size?: number;
  /** Ink colour — a single colour, the whole mark follows it. */
  color?: string;
  className?: string;
  /** Hide from assistive tech when the name is already announced nearby. */
  decorative?: boolean;
};

/** The logo, alone: the ring, the diner and the table line. */
export function KhangMark({ size = 44, color = INK, className, decorative }: MarkProps) {
  const c = KMARK.size / 2;

  return (
    <svg
      viewBox={`0 0 ${KMARK.size} ${KMARK.size}`}
      width={size}
      height={size}
      className={className}
      role={decorative ? "presentation" : "img"}
      aria-label={decorative ? undefined : "Khang"}
      aria-hidden={decorative ? true : undefined}
    >
      <g fill={color} stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <g dangerouslySetInnerHTML={{ __html: KMARK.figure.join("") }} />
        <circle cx={c} cy={c} r={KMARK.r} fill="none" strokeWidth={KMARK.ringWidth} />
      </g>
    </svg>
  );
}

type NameProps = {
  /** Rendered width in px. The name alone is the ink; the height follows. */
  size?: number;
  /** Draw "CHINESE · DIMSUM" under the name. */
  sub?: boolean;
  color?: string;
  className?: string;
  decorative?: boolean;
};

/** The restaurant name, alone: hand-lettering, brush underline, eyebrow. */
export function KhangName({ size = 180, sub = true, color = INK, className, decorative }: NameProps) {
  const scale = size / NAME_BOX.w;
  const box = sub ? NAME_BOX : { w: NAME_BOX.w, top: NAME_BOX.top, h: 90 };

  return (
    <svg
      viewBox={`0 ${box.top} ${box.w} ${box.h}`}
      width={size}
      height={box.h * scale}
      className={className}
      role={decorative ? "presentation" : "img"}
      aria-label={decorative ? undefined : "Khang"}
      aria-hidden={decorative ? true : undefined}
    >
      <g fill={color} stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <path d={KNAME.d} stroke="none" />
        <path d={KUNDERLINE} fill="none" strokeWidth={SHEET.underlineWidth} />
      </g>
      {sub && (
        // the eyebrow sits on the name's own line, quiet under the brush
        <path d={KSUB.d} transform="translate(8 54)" fill={color} opacity={0.72} />
      )}
    </svg>
  );
}

type LockupProps = MarkProps & { size?: number };

/** The two together: the mark, then the name on its own line beside it. */
export default function KhangLogo({
  size = 44,
  color = INK,
  className,
  decorative,
}: LockupProps) {
  const s = size / KMARK.size;

  return (
    <svg
      viewBox={`${SHEET.x} ${SHEET.y} ${SHEET.w} ${SHEET.h}`}
      width={SHEET.w * s}
      height={SHEET.h * s}
      className={className}
      role={decorative ? "presentation" : "img"}
      aria-label={decorative ? undefined : "Khang Chinese Restaurant and Dimsum"}
      aria-hidden={decorative ? true : undefined}
    >
      <g transform={`translate(${SHEET.markCx - KMARK.size / 2} ${SHEET.markCy - KMARK.size / 2})`}>
        <KhangMark size={KMARK.size} color={color} decorative />
      </g>

      <g fill={color} stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <g transform={`translate(${SHEET.nameX} ${SHEET.nameY})`}>
          <path d={KNAME.d} stroke="none" />
          <path d={KUNDERLINE} fill="none" strokeWidth={SHEET.underlineWidth} />
        </g>
        <path
          d={KSUB.d}
          transform={`translate(${SHEET.subX} ${SHEET.subY})`}
          opacity={0.72}
        />
      </g>
    </svg>
  );
}
