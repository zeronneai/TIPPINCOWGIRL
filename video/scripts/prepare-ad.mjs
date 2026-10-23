// ---------------------------------------------------------------------------
// The hat art the ad assembles, put where Remotion can serve it. Run by
// `npm run studio` and the `render:ad*` scripts; files already there are
// kept, so it is quick after the first time.
//
//   src/shop/layers/*.png  -> video/public/ad/layers/   (the builder's own
//                                                          accessory layers)
//   src/shop/layers/thumbs -> video/public/ad/thumbs/   (their thumbnails)
//   public/engraving/      -> video/public/engraving/   (its stamps and fonts)
//   public/hat/*.webp      -> video/public/ad/bases/    (every base in
//                                                          catalog.js, all types)
//
// All four folders are generated and gitignored: the originals stay where
// the site keeps them, so the ad always shows exactly what the builder draws.
// ---------------------------------------------------------------------------

import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASES, STRAW_BASES, SUEDE_BASES, artStem } from "../../src/shop/catalog.js";

const VIDEO = fileURLToPath(new URL("..", import.meta.url));
const ROOT = path.resolve(VIDEO, "..");
const LAYERS = path.join(VIDEO, "public", "ad", "layers");
const BASE_DIR = path.join(VIDEO, "public", "ad", "bases");

function copyLayers() {
  mkdirSync(LAYERS, { recursive: true });
  const src = path.join(ROOT, "src", "shop", "layers");
  let n = 0;
  for (const f of readdirSync(src).filter((f) => f.endsWith(".png"))) {
    const to = path.join(LAYERS, f);
    if (existsSync(to) && statSync(to).size === statSync(path.join(src, f)).size) continue;
    copyFileSync(path.join(src, f), to);
    n += 1;
  }
  console.log(`  layers: ${n} copied, ${readdirSync(LAYERS).length} in public/ad/layers`);
}

function copyThumbs() {
  cpSync(path.join(ROOT, "src", "shop", "layers", "thumbs"), path.join(VIDEO, "public", "ad", "thumbs"), { recursive: true });
  console.log("  thumbnails: public/ad/thumbs");
}

function copyEngraving() {
  cpSync(path.join(ROOT, "public", "engraving"), path.join(VIDEO, "public", "engraving"), { recursive: true });
  console.log("  engraving stamps and fonts: public/engraving");
}

function copyBases() {
  mkdirSync(BASE_DIR, { recursive: true });
  const all = [...BASES, ...SUEDE_BASES, ...STRAW_BASES].filter((b) => b.layerFile);
  let got = 0;
  let failed = 0;
  for (const b of all) {
    const to = path.join(BASE_DIR, `${b.publicId}.webp`);
    if (existsSync(to)) continue;
    // the builder's own 1600px artwork, from the site
    const from = path.join(ROOT, "public", "hat", `${artStem(b.layerFile)}.webp`);
    if (!existsSync(from)) {
      failed += 1;
      console.warn(`  missing ${from}`);
      continue;
    }
    copyFileSync(from, to);
    got += 1;
  }
  console.log(`  base hats: ${got} copied, ${readdirSync(BASE_DIR).length} in public/ad/bases${failed ? `, ${failed} missing` : ""}`);
  if (failed) process.exitCode = 1;
}

console.log("Hat art for the ad:");
copyLayers();
copyThumbs();
copyEngraving();
copyBases();
console.log(process.exitCode ? "Some base hats are missing from public/hat." : "Hat art ready.");
