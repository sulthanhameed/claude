interface Props {
  /** "dark" for light backgrounds, "light" for the deep-green footer. */
  tone?: "dark" | "light";
  /** Diameter of the 康 seal in pixels; the type scales from it. */
  size?: number;
  /** Show the "Chinese Restaurant & Dimsum" eyebrow. */
  tagline?: boolean;
  /** Only show the eyebrow from this breakpoint up. */
  taglineFrom?: "sm" | "md" | "lg";
  /** Hide the wordmark below the sm breakpoint (navbar on phones). */
  hideTextOnMobile?: boolean;
  className?: string;
}

/**
 * The house lockup: the 康 seal, the Playfair wordmark and the caps eyebrow.
 *
 * Proportions are fixed by the seal diameter — wordmark 0.62×, eyebrow 0.20×,
 * gap 0.28× — so the lockup is identical in the navbar, the footer and the
 * printed artwork; only the size changes.
 */
export default function BrandLockup({
  tone = "dark",
  size = 44,
  tagline = true,
  taglineFrom,
  hideTextOnMobile = false,
  className = "",
}: Props) {
  const light = tone === "light";
  const word = size * 0.62;
  const eyebrow = Math.max(7.5, size * 0.2);
  const from = taglineFrom === "lg" ? "hidden lg:block" : taglineFrom === "md" ? "hidden md:block" : taglineFrom === "sm" ? "hidden sm:block" : "block";

  return (
    <span className={`flex items-center ${className}`} style={{ gap: `${size * 0.28}px` }}>
      <span
        className={`relative grid shrink-0 place-items-center rounded-full ${
          light
            ? "bg-white"
            : "bg-gradient-to-br from-khang-red to-khang-red-dark shadow-lg shadow-green-900/30 ring-2 ring-white"
        }`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <span
          className={`font-cn leading-none ${light ? "text-khang-red" : "text-white"}`}
          style={{ fontSize: `${size * 0.52}px` }}
        >
          康
        </span>
      </span>

      <span className={`${hideTextOnMobile ? "hidden sm:flex" : "flex"} min-w-0 flex-col justify-center`}>
        <span
          className={`block font-brush font-semibold leading-none ${
            light ? "text-white" : "text-khang-red-dark"
          }`}
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
            className={`${from} font-mono font-medium uppercase leading-none ${
              light ? "text-white/55" : "text-khang-red/75"
            }`}
            style={{
              marginTop: `${eyebrow * 0.62}px`,
              fontSize: `${eyebrow}px`,
              letterSpacing: `${eyebrow * 0.27}px`,
            }}
          >
            Chinese Restaurant &amp; Dimsum
          </span>
        )}
      </span>
    </span>
  );
}
