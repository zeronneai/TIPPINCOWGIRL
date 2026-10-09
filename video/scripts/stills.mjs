// ---------------------------------------------------------------------------
// Render a few frames of a composition as PNGs, to check them by eye.
//
//   npm run stills -- TippinAd30 0,45,180,420
//
// Writes out/stills/<composition>-<frame>.png. Bundles once, so it is much
// faster than one `remotion still` per frame.
// ---------------------------------------------------------------------------

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [id = "TippinAd30", list = "0"] = process.argv.slice(2);
const frames = list.split(",").map(Number);
const out = path.resolve("out", "stills");
mkdirSync(out, { recursive: true });
console.log(`Stills of ${id}: frames ${frames.join(", ")} into out/stills`);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
const composition = await selectComposition({ serveUrl, id, browserExecutable });
for (const frame of frames) {
  const output = path.join(out, `${id}-${String(frame).padStart(4, "0")}.png`);
  await renderStill({ serveUrl, composition, frame, output, browserExecutable, imageFormat: "png" });
}
console.log(`Done: ${frames.length} stills.`);
