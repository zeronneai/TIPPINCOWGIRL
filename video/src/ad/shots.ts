import manifest from "../ad-shots.json";
import type { Box, ShotInfo } from "../shots";

// The ad's screenshots (scripts/capture-ad.mjs): the public site only.
const all = manifest.shots as unknown as Record<string, ShotInfo>;

export function adShot(name: string): ShotInfo {
  const s = all[name];
  if (!s) throw new Error(`No ad screenshot "${name}". Run npm run shots:ad.`);
  return s;
}

export const adBox = (name: string, key: string): Box => {
  const b = adShot(name).boxes[key];
  if (!b) throw new Error(`No box "${key}" on ad screenshot "${name}". Run npm run shots:ad.`);
  return b;
};
