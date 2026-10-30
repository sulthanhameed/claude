/**
 * Pages, and the routing between them.
 *
 * The site has exactly two URLs, so a router dependency would be more moving
 * parts than the job needs: `resolvePage()` reads `window.location` once and
 * `App` renders the matching page.
 *
 *   /        the restaurant (with the entrance film on a first visit)
 *   /brand   the name-and-logo clip on a white page of its own
 *
 * Anything else falls through to the restaurant, which is what the SPA rewrite
 * in `vercel.json` / `public/_redirects` already expects.
 */
export { default as HomePage } from "./HomePage";
export { default as BrandFilmPage } from "./BrandFilmPage";

export type Page = "home" | "brand";

/** Which page this URL asks for. Safe to call during render in the browser. */
export function resolvePage(): Page {
  if (typeof window === "undefined") return "home";

  // trailing slashes and any sub-path ending in /brand both count
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/brand" || path.endsWith("/brand")) return "brand";

  // `?intro=brand` is what older links to the film used
  if (new URLSearchParams(window.location.search).get("intro") === "brand") return "brand";

  return "home";
}
