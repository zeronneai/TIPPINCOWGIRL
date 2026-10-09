import React, { createContext, useContext } from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { type Box, SCREEN, type ShotInfo, shot } from "../shots";
import { C } from "../theme";

// A phone holding real screenshots. Inside it, <Shot> shows one capture
// (optionally zoomed onto a box), and <Ring> and <Tap> point at boxes that
// scripts/capture.mjs measured on that capture, so they land on the right
// button whatever the wording or layout of the app.

const ScreenCtx = createContext({ k: 1, w: 390, h: 844 });
export const useScreen = () => useContext(ScreenCtx);

export const Phone: React.FC<{
  x: number;
  top: number;
  height: number;
  enter?: number;
  rotate?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ x, top, height, enter = 1, rotate = 0, style, children }) => {
  const bezel = Math.round(height * 0.016);
  const h = height - bezel * 2;
  const w = Math.round((h * SCREEN.width) / SCREEN.height);
  const k = w / SCREEN.width;
  const y = interpolate(enter, [0, 1], [160, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: x - (w + bezel * 2) / 2,
        top,
        width: w + bezel * 2,
        height,
        borderRadius: bezel * 4.2,
        background: `linear-gradient(145deg, #4a3324 0%, ${C.brown} 45%, #1d130c 100%)`,
        padding: bezel,
        boxShadow: "0 60px 120px -40px rgba(43,26,16,.55), 0 24px 50px -20px rgba(43,26,16,.45), inset 0 0 0 2px rgba(255,255,255,.08)",
        opacity: interpolate(enter, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${y}px) rotate(${rotate}deg) scale(${interpolate(enter, [0, 1], [0.94, 1])})`,
        ...style,
      }}
    >
      <div style={{ position: "relative", width: w, height: h, borderRadius: bezel * 3.2, overflow: "hidden", background: C.cream }}>
        <ScreenCtx.Provider value={{ k, w, h }}>{children}</ScreenCtx.Provider>
      </div>
    </div>
  );
};

/** One screenshot filling the screen; `zoom` eases the camera onto a box. */
export const Shot: React.FC<{
  name: string;
  /** a screenshot from another manifest (the ad's); default: the demo's */
  info?: ShotInfo;
  opacity?: number;
  zoom?: { box: Box; scale: number; p: number };
  y?: number;
  children?: React.ReactNode;
}> = ({ name, info, opacity = 1, zoom, y = 0, children }) => {
  const { k, w, h } = useScreen();
  const s = info ?? shot(name);
  const contentH = (w * s.height) / s.width;
  let transform = `translateY(${-y * k}px)`;
  if (zoom) {
    const z = 1 + (zoom.scale - 1) * zoom.p;
    const cx = (zoom.box[0] + zoom.box[2] / 2) * k;
    const cy = (zoom.box[1] + zoom.box[3] / 2) * k;
    let tx = cx + (w / 2 - cx) * zoom.p - cx * z;
    let ty = cy + (h / 2 - cy) * zoom.p - cy * z;
    tx = Math.min(0, Math.max(w - w * z, tx));
    ty = Math.min(0, Math.max(h - contentH * z, ty));
    transform = `translate(${tx}px, ${ty}px) scale(${z})`;
  }
  if (opacity <= 0) return null;
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: contentH, transform, transformOrigin: "0 0" }}>
        <Img src={staticFile(s.file)} style={{ width: w, height: contentH, display: "block" }} />
        {children}
      </div>
    </div>
  );
};

/** A coral outline that draws attention to a box on the screenshot. */
export const Ring: React.FC<{ box: Box; p: number; pad?: number; radius?: number; color?: string }> = ({ box, p, pad = 6, radius = 16, color = C.coral }) => {
  const { k } = useScreen();
  const f = useCurrentFrame();
  if (p <= 0) return null;
  const pulse = 1 + Math.sin(f / 6) * 0.012;
  return (
    <div
      style={{
        position: "absolute",
        left: (box[0] - pad) * k,
        top: (box[1] - pad) * k,
        width: (box[2] + pad * 2) * k,
        height: (box[3] + pad * 2) * k,
        borderRadius: radius * k,
        border: `${Math.max(3, 3.2 * k)}px solid ${color}`,
        boxShadow: `0 0 0 ${8 * k}px rgba(232,103,74,.18), 0 0 ${30 * k}px rgba(232,103,74,.35)`,
        opacity: Math.min(1, p * 1.4),
        transform: `scale(${interpolate(p, [0, 1], [1.12, 1]) * pulse})`,
        pointerEvents: "none",
      }}
    />
  );
};

/** A finger tap on the middle of a box at frame `at` (the scene's own frames). */
export const Tap: React.FC<{ box: Box; at: number }> = ({ box, at }) => {
  const { k } = useScreen();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f - at;
  if (t < -14 || t > 26) return null;
  const cx = (box[0] + box[2] / 2) * k;
  const cy = (box[1] + box[3] / 2) * k;
  const arrive = spring({ frame: t + 14, fps, config: { damping: 14, stiffness: 160 } });
  const press = t >= 0 && t < 6 ? 0.82 : 1;
  const ripple = interpolate(t, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fade = interpolate(t, [14, 26], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const size = 46 * k;
  return (
    <div style={{ position: "absolute", left: cx, top: cy, pointerEvents: "none", opacity: fade }}>
      {t >= 0 && (
        <div
          style={{
            position: "absolute",
            width: size * 3,
            height: size * 3,
            left: (-size * 3) / 2,
            top: (-size * 3) / 2,
            borderRadius: "50%",
            border: `${4 * k}px solid rgba(232,103,74,${0.8 * (1 - ripple)})`,
            transform: `scale(${0.3 + ripple * 0.9})`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          width: size,
          height: size,
          left: -size / 2,
          top: -size / 2,
          borderRadius: "50%",
          background: "rgba(255,255,255,.75)",
          border: `${3 * k}px solid ${C.ink}`,
          boxShadow: "0 8px 20px rgba(43,26,16,.35)",
          transform: `translate(${(1 - arrive) * 60 * k}px, ${(1 - arrive) * 90 * k}px) scale(${press})`,
        }}
      />
    </div>
  );
};
