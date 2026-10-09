// ---------------------------------------------------------------------------
// The site's two fonts, downloaded once into video/public/fonts so the video
// renders with them: Alfa Slab One (Google Fonts) for titles and Satoshi
// (Fontshare) for everything else; plus Playfair Display Italic (Google
// Fonts) for the ad's serif lines. Run by `npm run studio` and
// `npm run render` before they start; files already there are kept.
//
// The font files are not committed (public/fonts is gitignored): they come
// from their publishers. Without them the video still renders, in the
// system's serif and sans fonts, so a failed download never stops a render.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("../public/fonts/", import.meta.url));
// a desktop browser's user agent, so Google answers with woff2
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function text(url) {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  return r.text();
}

async function save(url, file) {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  writeFileSync(path.join(DIR, file), Buffer.from(await r.arrayBuffer()));
  console.log(`  ${file}`);
}

async function alfa() {
  if (existsSync(path.join(DIR, "alfa-slab-one.woff2"))) return;
  const css = await text("https://fonts.googleapis.com/css2?family=Alfa+Slab+One&display=swap");
  const latin = css.split("/* latin */")[1] || css;
  await save(latin.match(/url\((https:[^)]+\.woff2)\)/)[1], "alfa-slab-one.woff2");
}

async function playfair() {
  if (existsSync(path.join(DIR, "playfair-italic.woff2"))) return;
  const css = await text("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500&display=swap");
  const latin = css.split("/* latin */")[1] || css;
  await save(latin.match(/url\((https:[^)]+\.woff2)\)/)[1], "playfair-italic.woff2");
}

async function satoshi() {
  const weights = [400, 500, 700, 900];
  if (weights.every((w) => existsSync(path.join(DIR, `satoshi-${w}.woff2`)))) return;
  const css = await text(`https://api.fontshare.com/v2/css?f[]=satoshi@${weights.join(",")}&display=swap`);
  for (const block of css.split("@font-face").slice(1)) {
    const w = Number(block.match(/font-weight:\s*(\d+)/)?.[1]);
    const url = block.match(/url\('?(\/\/[^')]+\.woff2)'?\)/)?.[1];
    if (weights.includes(w) && url) await save(`https:${url}`, `satoshi-${w}.woff2`);
  }
}

mkdirSync(DIR, { recursive: true });
console.log("Fonts for the video (public/fonts):");
for (const [name, get] of [["Alfa Slab One", alfa], ["Playfair Display Italic", playfair], ["Satoshi", satoshi]]) {
  try {
    await get();
  } catch (e) {
    console.warn(`  could not download ${name} (${e.message}); the video will use a system font instead.`);
  }
}
console.log("Fonts ready.");
