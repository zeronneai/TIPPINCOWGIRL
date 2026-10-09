// ---------------------------------------------------------------------------
// The hat art the ad assembles, put where Remotion can serve it. Run by
// `npm run studio` and the `render:ad*` scripts; files already there are
// kept, so it is quick after the first time.
//
//   src/shop/layers/*.png  -> video/public/ad/layers/   (the builder's own
//                                                          accessory layers)
//   src/shop/layers/thumbs -> video/public/ad/thumbs/   (their thumbnails)
//   public/engraving/      -> video/public/engraving/   (its stamps and fonts)
//   Cloudinary base hats   -> video/public/ad/bases/    (every base in
//                                                          catalog.js, all types)
//
// All four folders are generated and gitignored: the originals stay where
// the site keeps them, so the ad always shows exactly what the builder draws.
// ---------------------------------------------------------------------------

import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASES, CLOUDINARY_CLOUD, STRAW_BASES, SUEDE_BASES } from "../../src/shop/catalog.js";

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

async function downloadBases() {
  mkdirSync(BASE_DIR, { recursive: true });
  const all = [...BASES, ...SUEDE_BASES, ...STRAW_BASES].filter((b) => b.layerFile);
  let got = 0;
  let failed = 0;
  for (const b of all) {
    const to = path.join(BASE_DIR, `${b.publicId}.png`);
    if (existsSync(to)) continue;
    // the stored PNG at the builder's 1600px
    const url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/f_png,w_1600/${b.layerFile}`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      writeFileSync(to, Buffer.from(await r.arrayBuffer()));
      got += 1;
    } catch (e) {
      failed += 1;
      console.warn(`  could not download ${b.publicId} (${e.message})`);
    }
  }
  console.log(`  base hats: ${got} downloaded, ${readdirSync(BASE_DIR).length} in public/ad/bases${failed ? `, ${failed} failed` : ""}`);
  if (failed) process.exitCode = 1;
}

console.log("Hat art for the ad:");
copyLayers();
copyThumbs();
copyEngraving();
await downloadBases();
console.log(process.exitCode ? "Some base hats are missing; check the network and run it again." : "Hat art ready.");
