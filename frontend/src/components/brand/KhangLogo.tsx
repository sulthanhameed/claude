import { useId } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   Khang brand mark.

   A deep-green seal holding a bowl of noodles and two chopsticks — the whole
   restaurant in one glyph, legible down to 16 px. Vector only: no Chinese
   glyph, no image file, no font dependency.

   The matching static files (same geometry) live in frontend/public:
     logo-mark.svg · favicon.svg · logo-lockup.svg ·
     logo-lockup-light.svg · logo-lockup-mono.svg · wordmark.svg
   ───────────────────────────────────────────────────────────────────────── */

type Tone = "dark" | "light";

interface MarkProps {
  /** Rendered width/height in pixels. */
  size?: number;
  /** "dark" = filled green seal, "light" = outline seal for dark backgrounds. */
  tone?: Tone;
  className?: string;
  title?: string;
}

export function KhangMark({ size = 44, tone = "dark", className = "", title = "Khang" }: MarkProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `khang-seal-${uid}`;
  const solid = tone === "dark";
  const ink = solid ? "#ffffff" : "currentColor";

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      focusable="false"
    >
      {solid && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1aa554" />
            <stop offset="46%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#064e2e" />
          </linearGradient>
        </defs>
      )}
      <circle
        cx="24"
        cy="24"
        r={solid ? 23 : 22.2}
        fill={solid ? `url(#${gradId})` : "none"}
        stroke={solid ? "none" : ink}
        strokeWidth={solid ? 0 : 1.5}
        strokeOpacity={0.85}
      />
      <circle cx="24" cy="24" r="19.5" fill="none" stroke={ink} strokeOpacity="0.32" strokeWidth="0.9" />
      <g fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.9 25.2h22.2c0 6.3-4.9 11-11.1 11s-11.1-4.7-11.1-11Z" strokeWidth="2.2" />
        <path d="M16.4 32.6h15.2" strokeWidth="1.6" strokeOpacity="0.55" />
        <path d="M25.4 10.4 19.8 23.4" strokeWidth="2.2" />
        <path d="M30.9 11.7 25.2 22.2" strokeWidth="2.2" />
      </g>
    </svg>
  );
}

interface LogoProps extends MarkProps {
  /** "lockup" = seal + wordmark, "mark" = seal only. */
  variant?: "lockup" | "mark";
  /** Show the "Chinese Restaurant & Dimsum" line. */
  tagline?: boolean;
  /** Multiplies the computed type sizes (1 = the sizes below). */
  scale?: number;
  /** Drop the wordmark below the sm breakpoint and keep just the seal. */
  hideTextOnMobile?: boolean;
}

export default function KhangLogo({
  variant = "lockup",
  tone = "dark",
  tagline = true,
  size = 46,
  scale = 1,
  hideTextOnMobile = false,
  className = "",
  title = "Khang Chinese Restaurant & Dimsum",
}: LogoProps) {
  if (variant === "mark") {
    return <KhangMark size={size} tone={tone} className={className} title={title} />;
  }

  const light = tone === "light";
  // Proportions taken from the printed lockup: word ≈ 0.62 × seal, tag ≈ 0.20 × seal.
  const word = size * 0.62 * scale;
  const tag = size * 0.2 * scale;
  const gap = size * 0.28;

  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: `${gap}px` }}>
      <KhangMark size={size} tone={tone} title={title} />
      <span
        className={`${hideTextOnMobile ? "hidden sm:flex" : "flex"} flex-col justify-center`}
      >
        <span
          className={`font-brush font-semibold leading-none ${light ? "text-white" : "text-khang-red-dark"}`}
          style={{
            fontSize: `${word}px`,
            letterSpacing: `${word * 0.055}px`,
            paddingLeft: `${word * 0.055}px`,
          }}
        >
          Khang
        </span>
        {tagline && (
          <span
            className={`font-mono uppercase leading-none ${light ? "text-white/60" : "text-khang-red/75"}`}
            style={{
              marginTop: `${tag * 0.62}px`,
              fontSize: `${tag}px`,
              letterSpacing: `${tag * 0.27}px`,
            }}
          >
            Chinese Restaurant &amp; Dimsum
          </span>
        )}
      </span>
    </span>
  );
}
