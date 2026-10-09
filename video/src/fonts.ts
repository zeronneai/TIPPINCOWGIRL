import { continueRender, delayRender, staticFile } from "remotion";

// Loads the fonts from public/fonts (scripts/fetch-fonts.mjs puts them
// there). A missing file is skipped: the text falls back to a system font
// and the render goes on.
const FACES: [string, string, string][] = [
  ["Alfa Slab One", "alfa-slab-one.woff2", "400"],
  ["Satoshi", "satoshi-400.woff2", "400"],
  ["Satoshi", "satoshi-500.woff2", "500"],
  ["Satoshi", "satoshi-700.woff2", "700"],
  ["Satoshi", "satoshi-900.woff2", "900"],
];

let started = false;
export function loadFonts() {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading fonts");
  Promise.all(
    FACES.map(async ([family, file, weight]) => {
      try {
        const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, { weight });
        document.fonts.add(await face.load());
      } catch {
        console.warn(`Font ${file} is missing; run npm run fonts. Using a system font.`);
      }
    })
  ).finally(() => continueRender(handle));
}
