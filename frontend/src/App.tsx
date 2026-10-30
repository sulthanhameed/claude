import { BrandFilmPage, HomePage, resolvePage } from "./pages";

/**
 * The whole app is a choice between two pages. Everything a page needs —
 * providers, sections, overlays, the entrance film — lives in `src/pages/`,
 * so this file stays a switch rather than a second page in disguise.
 */
export default function App() {
  return resolvePage() === "brand" ? <BrandFilmPage /> : <HomePage />;
}
