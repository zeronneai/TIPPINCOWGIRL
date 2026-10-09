import React, { useEffect, useState } from "react";
import { continueRender, delayRender, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
// The builder's own modules: the same layer files, z-order, blends and
// engraving drawing as the hat on the site (see src/shop/catalog.js).
// @ts-expect-error plain JS module from the site
import { BLEND, Z_INDEX, accessoryLayers, baseArtFor } from "../../../src/shop/catalog.js";
// @ts-expect-error plain JS module from the site
import EngravingLayer from "../../../src/shop/EngravingLayer.jsx";
// @ts-expect-error plain JS module from the site
import { fontReady, stampShape, useEngravingAssets } from "../../../src/shop/engraving.js";
// @ts-expect-error plain JS module from the site
import { ENGRAVING_FONT_FILES, ENGRAVING_STAMPS } from "../../../src/shop/engravingArt.js";
import type { HatConfig } from "../ad-hats";

// The engraving fonts and stamps live at /engraving/... on the site; here
// scripts/prepare-ad.mjs copies them to public/engraving, which Remotion
// serves under its own prefix. Point the builder's tables there once.
for (const f of Object.values(ENGRAVING_FONT_FILES) as { url: string }[]) if (f.url.startsWith("/engraving/")) f.url = staticFile(f.url.slice(1));
for (const s of ENGRAVING_STAMPS as { file: string }[]) if (s.file.startsWith("/engraving/")) s.file = staticFile(s.file.slice(1));

type Layer = { key: string; src: string; z: number; blend: string };

/** The picture layers of a hat, bottom to top, as the builder stacks them. */
export function hatLayers(config: HatConfig): Layer[] {
  const base = baseArtFor(config) as { publicId: string } | null;
  const out: Layer[] = [];
  if (base) out.push({ key: `base:${base.publicId}`, src: staticFile(`ad/bases/${base.publicId}.png`), z: Z_INDEX.base, blend: BLEND.base });
  for (const l of accessoryLayers(config) as { key: string; z: number; blend: string }[]) out.push({ key: l.key, src: staticFile(`ad/layers/${l.key}.png`), z: l.z, blend: l.blend });
  return out;
}

/** Hold the render until the engraving's fonts and stamps have loaded. */
function useEngravingReady(engraving: HatConfig["engraving"]) {
  const list = engraving ?? [];
  useEngravingAssets(list);
  const ready = list.every((e) => (e.kind === "stamp" ? !!stampShape(e.stampId) : fontReady(e.font)));
  const [handle] = useState(() => (list.length && !ready ? delayRender("Engraving fonts and stamps") : null));
  useEffect(() => {
    if (ready && handle !== null) continueRender(handle);
  }, [ready, handle]);
  return ready;
}

const bump = (x: number) => (x > 0 && x < 10 ? Math.sin((Math.PI * x) / 10) : 0);

export const Hat: React.FC<{
  config: HatConfig;
  size: number;
  /** pieces drop in one after another: base at `start`, then every `gap` frames */
  assemble?: { start: number; gap: number };
  /** the hat it changes from (the montage): new pieces drop at `changeAt`, gone ones fade */
  prev?: HatConfig;
  changeAt?: number;
  /** the engraving burns in from this frame (shown at once if not given) */
  engraveAt?: number;
  /** a soft light sweeps across the hat from this frame */
  sweepAt?: number;
  shadow?: boolean;
  style?: React.CSSProperties;
}> = ({ config, size, assemble, prev, changeAt = 0, engraveAt, sweepAt, shadow = true, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layers = hatLayers(config);
  const before = prev ? hatLayers(prev) : null;
  const beforeKeys = new Set(before?.map((l) => l.key));
  const nowKeys = new Set(layers.map((l) => l.key));
  const gone = before ? before.filter((l) => !nowKeys.has(l.key)) : [];
  const engraving = config.engraving ?? [];
  useEngravingReady(engraving);

  const arrival = (l: Layer, i: number) => {
    if (assemble) return assemble.start + i * assemble.gap;
    if (before && !beforeKeys.has(l.key)) return changeAt;
    return -1000;
  };
  const arrivals = layers.map(arrival);
  // the whole hat dips a little each time a piece lands
  const squash = arrivals.reduce((s, a, i) => s + (i ? 0.018 * bump(f - a - 7) : 0), 0);

  const engrave = engraving.length ? (engraveAt == null ? 1 : interpolate(f, [engraveAt, engraveAt + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })) : 0;
  const sweep = sweepAt == null ? -1 : interpolate(f, [sweepAt, sweepAt + 26], [-0.4, 1.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const baseSrc = layers.find((l) => l.key.startsWith("base:"))?.src;

  return (
    <div style={{ position: "relative", width: size, height: size, ...style }}>
      {shadow && (
        <div
          style={{
            position: "absolute",
            left: "12%",
            right: "12%",
            top: "70%",
            height: "14%",
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(10,5,2,.55), rgba(10,5,2,0))",
            filter: "blur(6px)",
            opacity: assemble ? interpolate(f, [assemble.start, assemble.start + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1,
          }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, isolation: "isolate", transform: `scale(${1 - squash}, ${1 - squash * 1.4})`, transformOrigin: "50% 78%" }}>
        {layers.map((l, i) => {
          const a = arrivals[i];
          const p = a < -100 ? 1 : spring({ frame: f - a, fps, config: { damping: 13, stiffness: 150, mass: 0.7 } });
          const isBase = l.key.startsWith("base:");
          const y = isBase ? (1 - p) * size * 0.08 : (1 - p) * -size * 0.26;
          const sc = isBase ? 0.82 + p * 0.18 : 1 + (1 - p) * 0.1;
          const op = interpolate(p, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
          const falling = !isBase && a > -100 && p < 0.98;
          return (
            <div key={l.key} style={{ position: "absolute", inset: 0, zIndex: l.z, mixBlendMode: l.blend as React.CSSProperties["mixBlendMode"] }}>
              <Img
                src={l.src}
                style={{
                  width: size,
                  height: size,
                  opacity: op,
                  transform: `translateY(${y}px) scale(${sc})`,
                  filter: falling ? `drop-shadow(0 ${(1 - p) * 40}px ${10 + (1 - p) * 20}px rgba(0,0,0,${0.35 * (1 - p)}))` : undefined,
                }}
              />
            </div>
          );
        })}
        {gone.map((l) => {
          const o = interpolate(f, [changeAt, changeAt + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return o > 0 ? (
            <div key={`gone-${l.key}`} style={{ position: "absolute", inset: 0, zIndex: l.z, mixBlendMode: l.blend as React.CSSProperties["mixBlendMode"], opacity: o }}>
              <Img src={l.src} style={{ width: size, height: size }} />
            </div>
          ) : null;
        })}
        {engrave > 0 && (
          <div style={{ position: "absolute", inset: 0, zIndex: Z_INDEX.brand, mixBlendMode: "multiply", clipPath: `inset(0 ${(1 - engrave) * 100}% 0 0)` }}>
            <EngravingLayer engraving={engraving} hatType={config.hatType} z={0} />
          </div>
        )}
        {engrave > 0 && engrave < 1 && (
          // the ember at the burning edge
          <div
            style={{
              position: "absolute",
              zIndex: 60,
              left: `${engrave * 100 - 8}%`,
              top: "30%",
              width: "16%",
              height: "26%",
              background: "radial-gradient(closest-side, rgba(255,190,90,.75), rgba(232,103,74,.35) 45%, rgba(232,103,74,0))",
              mixBlendMode: "screen",
              filter: "blur(4px)",
            }}
          />
        )}
        {sweep > -0.4 && sweep < 1.4 && baseSrc && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 70,
              background: `linear-gradient(105deg, rgba(255,240,210,0) ${sweep * 100 - 14}%, rgba(255,240,210,.55) ${sweep * 100}%, rgba(255,240,210,0) ${sweep * 100 + 14}%)`,
              mixBlendMode: "soft-light",
              WebkitMaskImage: `url(${baseSrc})`,
              WebkitMaskSize: "100% 100%",
              maskImage: `url(${baseSrc})`,
              maskSize: "100% 100%",
            }}
          />
        )}
      </div>
    </div>
  );
};
