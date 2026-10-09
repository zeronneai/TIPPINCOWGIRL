import manifest from "./shots.json";

// The screenshots and what scripts/capture.mjs measured on them. Boxes are
// [x, y, width, height] in the phone's CSS pixels (a 390 x 844 screen).
export type Box = [number, number, number, number];
export type ShotInfo = { file: string; width: number; height: number; boxes: Record<string, Box> };

const all = manifest.shots as unknown as Record<string, ShotInfo>;

export function shot(name: string): ShotInfo {
  const s = all[name];
  if (!s) throw new Error(`No screenshot "${name}". Run npm run shots.`);
  return s;
}

export const box = (name: string, key: string): Box => {
  const b = shot(name).boxes[key];
  if (!b) throw new Error(`No box "${key}" on "${name}". Run npm run shots.`);
  return b;
};

export const demo = manifest.data;
export const SCREEN = { width: manifest.viewport.width, height: manifest.viewport.height };
