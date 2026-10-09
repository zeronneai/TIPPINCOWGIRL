// ---------------------------------------------------------------------------
// A hat, full screen: assembled layer by layer from the builder's real PNGs
// (same z-order: base, feather, cord, bud, matches) with the builder's own
// engraving, spring drops, a light sweep, and a slow orbit-like parallax.
// Can start where the live preview's hat was on the phone (a match cut).
// ---------------------------------------------------------------------------

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Hat } from "../ad/Hat";
import type { HatConfig } from "../ad-hats";
import { DustPuff, Halftone, Sparkles, type Rect } from "./comic";
import { C } from "./theme";
import { eased, lerp, prog } from "./motion";

export const HAT_CENTER = { x: 540, y: 1110 };
export const HAT_SIZE = 900;

/** Cream ground, a slow coral sunburst, halftone: the hat's stage. */
export const HatGround: React.FC<{ spin?: number; shift?: number }> = ({ spin = 0, shift = 0 }) => (
  <AbsoluteFill style={{ background: C.cream }}>
    <AbsoluteFill
      style={{
        background: `repeating-conic-gradient(from ${spin}deg at 50% 57%, rgba(232,103,74,.13) 0deg 6deg, rgba(232,103,74,0) 6deg 15deg)`,
        WebkitMaskImage: "radial-gradient(60% 45% at 50% 57%, rgba(0,0,0,.9) 0%, rgba(0,0,0,.25) 70%, rgba(0,0,0,0) 100%)",
        maskImage: "radial-gradient(60% 45% at 50% 57%, rgba(0,0,0,.9) 0%, rgba(0,0,0,.25) 70%, rgba(0,0,0,0) 100%)",
      }}
    />
    <AbsoluteFill style={{ background: "radial-gradient(42% 26% at 50% 58%, rgba(255,250,240,.95), rgba(255,250,240,0) 70%)" }} />
    <Halftone shift={shift} />
  </AbsoluteFill>
);

export const HeroHat: React.FC<{
  config: HatConfig;
  /** where the hat comes from (the preview on the phone): it grows from there */
  fromRect?: Rect;
  /** pieces drop one after another from this frame, `gap` frames apart */
  assemble?: { start: number; gap: number };
  /** the hat changes from `prev` at `changeAt` (new pieces slam on) */
  prev?: HatConfig;
  changeAt?: number;
  engraveAt?: number;
  sweepAt?: number;
  sparkleAt?: number;
  /** frames where a piece lands (a dust puff on the brim) */
  impacts?: number[];
  size?: number;
  /** the clock of the whole ad, so the orbit never jumps between shots */
  clock?: number;
}> = ({ config, fromRect, assemble, prev, changeAt, engraveAt, sweepAt, sparkleAt, impacts = [], size = HAT_SIZE, clock = 0 }) => {
  const f = useCurrentFrame();
  const g = f + clock;
  // the match cut: from the preview's place and size to the hero spot
  const m = fromRect ? eased(prog(f, 0, 12), "glide", 0.04) : 1;
  const cx = fromRect ? lerp(fromRect.x + fromRect.w / 2, HAT_CENTER.x, m) : HAT_CENTER.x;
  const cy = fromRect ? lerp(fromRect.y + fromRect.w / 2, HAT_CENTER.y, m) : HAT_CENTER.y;
  const sz = fromRect ? lerp(fromRect.w, size, m) : size;
  // the orbit: a slow sway as if the camera circled the hat a little
  const orbit = Math.sin(g / 46);
  const rotY = orbit * 9 * m;
  const dx = orbit * 22 * m;
  const dy = Math.sin(g / 33) * 9 * m;
  return (
    <AbsoluteFill>
      <HatGround spin={g * 0.12} shift={-g * 0.6} />
      {/* the floor shadow moves against the hat: depth */}
      <div
        style={{
          position: "absolute",
          left: cx - sz * 0.36 - dx * 0.5,
          top: cy + sz * 0.24,
          width: sz * 0.72,
          height: sz * 0.12,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(43,33,24,.32), rgba(43,33,24,0))",
          filter: "blur(8px)",
        }}
      />
      <div style={{ position: "absolute", left: cx - sz / 2 + dx, top: cy - sz / 2 + dy, width: sz, height: sz, perspective: 1800 }}>
        <div style={{ width: sz, height: sz, transform: `rotateY(${rotY}deg)`, transformOrigin: "50% 60%" }}>
          <Hat config={config} size={sz} assemble={assemble} prev={prev} changeAt={changeAt} engraveAt={engraveAt} sweepAt={sweepAt} shadow={false} />
        </div>
      </div>
      {impacts.map((t, i) => (
        <DustPuff key={i} x={cx + dx + (i % 2 ? 1 : -1) * sz * 0.18} y={cy + sz * 0.2} at={t} size={1.1} seed={`hat${i}`} />
      ))}
      {sparkleAt != null && <Sparkles x={cx + dx} y={cy - sz * 0.05} at={sparkleAt} count={8} radius={sz * 0.42} size={30} seed="hat" />}
    </AbsoluteFill>
  );
};
