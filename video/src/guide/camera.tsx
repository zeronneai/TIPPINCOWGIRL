// ---------------------------------------------------------------------------
// The virtual camera: the real site, captured as tall pages (see
// scripts/capture-guide.mjs), inside a phone, filmed by a camera that
// scrolls, pushes in, pans and whips, driven by keyframes.
//
// Two levels, like a real shoot:
//   - the phone's own screen: which page (surface) it shows and how far it
//     is scrolled, with the nav and the builder's live preview pinned the way
//     the site pins them, drawers sliding in, buttons pressed;
//   - the camera filming the phone: push-ins on a point of the screen,
//     a little 3D tilt and float between beats, and "full bleed" moments
//     where the phone frame drops away and the page fills the frame.
//
// camAt(frame, keys) is a pure function, so the star guide and the comic
// overlays can ask where anything on the page is on the video frame
// (project / projectRect) at any frame, past ones included (trails).
// ---------------------------------------------------------------------------

import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import shots from "../guide-shots.json";
import { C } from "./theme";
import { type Key, clamp01, lerp, prog, step, track } from "./motion";

export const VW = shots.width; // the phone's CSS width (390)
export const VH = 844; // and height
const NAV_H = 68;
const STICK_TOP = 64; // the live preview sticks this far down (styles.css)

/** The phone at rest on the frame: its screen rectangle, in video pixels. */
export const PHONE = { x: 250, y: 610, w: 580, h: (580 * VH) / VW, bezel: 18, radius: 74 };
/** Where a push-in puts the point it pushes into. */
export const ANCHOR = { x: 540, y: 1150 };

type SurfaceInfo = {
  width: number;
  height: number;
  top: number;
  tiles: { file: string; y: number; h: number }[];
  boxes: Record<string, number[]>;
  sections: Record<string, number[]>;
};
export type SurfaceName = keyof typeof shots.surfaces;
export const SURFACES = shots.surfaces as unknown as Record<SurfaceName, SurfaceInfo>;
const OVERLAYS = shots.overlays as unknown as Record<string, { file: string; box: number[]; cart?: number[] }>;
const DRAWERS = shots.drawers as unknown as Record<string, { file: string; width: number; height: number; boxes: Record<string, number[]> }>;

/** A box [x, y, w, h] on a surface (CSS px from its top). */
export const box = (surface: SurfaceName, name: string): number[] => {
  const s = SURFACES[surface];
  const b = s.boxes[name] ?? s.sections[name];
  if (!b) throw new Error(`no box "${name}" on ${surface}`);
  return b;
};
export const drawerBox = (drawer: string, name: string) => DRAWERS[drawer].boxes[name];
export const navBox = (name: "cart") => OVERLAYS.nav[name] as number[];

/** Scroll that puts the top of a box `below` CSS px under the top of the screen. */
export const scrollFor = (surface: SurfaceName, name: string, below = 120) => box(surface, name)[1] - below;

// ---- keys and state -------------------------------------------------------------------------------------
export type Mark = { from: number; to: number; rect: number[]; kind: "ring" | "press"; on?: "page" | "screen" };

export type CamKeys = {
  surface: [number, SurfaceName][];
  scroll?: Key[];
  zoom?: Key[];
  /** the point the camera pushes into, in screen CSS px */
  fx?: Key[];
  fy?: Key[];
  /** 0 = phone, 1 = full bleed */
  bleed?: Key[];
  /** extra phone moves (video px and degrees) on top of the float */
  x?: Key[];
  y?: Key[];
  tiltX?: Key[];
  tiltY?: Key[];
  /** how much the phone floats and tilts on its own (0 during push-ins) */
  float?: Key[];
  stage?: [number, string][];
  nav?: [number, "nav" | "nav-cart"][];
  drawer?: { name: string; open: number; close?: number; clipBottom?: number };
  marks?: Mark[];
  /** the section's first frame in the whole ad: the float runs on the ad's clock, so it never jumps at a cut */
  clock?: number;
};

export type Cam = {
  f: number;
  surface: SurfaceName;
  scroll: number;
  zoom: number;
  fx: number;
  fy: number;
  bleed: number;
  x: number;
  y: number;
  tiltX: number;
  tiltY: number;
  /** the screen rectangle before the push-in and tilt, video px */
  rect: { x: number; y: number; w: number; h: number };
  /** video px per CSS px on the screen (before the push-in) */
  s: number;
  /** how many CSS px of page show on the screen */
  viewH: number;
  stage: string;
  nav: "nav" | "nav-cart";
  drawer: number; // 0..1 open
  keys: CamKeys;
};

const T = (keys: Key[] | undefined, f: number, v: number) => (keys?.length ? track(f, keys) : v);

const DEFAULT_STAGE: Record<SurfaceName, string> = {
  home: "stage-default",
  "builder-base": "stage-wool",
  "builder-style": "stage-bud",
  "builder-engrave": "stage-engraved",
  "builder-size": "stage-engraved",
};

export function camAt(f: number, keys: CamKeys): Cam {
  const surface = step(f, keys.surface);
  const bleed = clamp01(T(keys.bleed, f, 0));
  const fl = T(keys.float, f, 1);
  // the float: slow, never in sync, so it reads as a hand and not a loop
  const g = f + (keys.clock ?? 0);
  const floatY = Math.sin(g / 37) * 7 * fl;
  const floatTX = Math.sin(g / 53 + 1) * 1.6 * fl;
  const floatTY = Math.cos(g / 61) * 2.2 * fl;
  const rect = {
    x: lerp(PHONE.x, 0, bleed),
    y: lerp(PHONE.y, 0, bleed),
    w: lerp(PHONE.w, 1080, bleed),
    h: lerp(PHONE.h, 1920, bleed),
  };
  const s = rect.w / VW;
  const viewH = rect.h / s;
  const sf = SURFACES[surface];
  const maxScroll = Math.max(0, sf.height - viewH);
  const d = keys.drawer;
  const drawer = d ? (f < d.open ? 0 : d.close != null && f >= d.close ? 1 - prog(f, d.close, d.close + 8) : track(f, [{ f: d.open, v: 0 }, { f: d.open + 10, v: 1, ease: "out" }])) : 0;
  return {
    f,
    surface,
    scroll: Math.max(0, Math.min(maxScroll, T(keys.scroll, f, 0))),
    zoom: T(keys.zoom, f, 1),
    fx: T(keys.fx, f, VW / 2),
    fy: T(keys.fy, f, VH / 2),
    bleed,
    x: T(keys.x, f, 0),
    y: T(keys.y, f, 0) + floatY,
    tiltX: T(keys.tiltX, f, 0) + floatTX,
    tiltY: T(keys.tiltY, f, 0) + floatTY,
    rect,
    s,
    viewH,
    stage: keys.stage ? step(f, keys.stage) : DEFAULT_STAGE[surface],
    nav: keys.nav ? step(f, keys.nav) : "nav",
    drawer,
    keys,
  };
}

// ---- projection: screen CSS px -> video px ---------------------------------------------------------------
const PERSPECTIVE = 2400;
const rad = (d: number) => (d * Math.PI) / 180;

/** The phone's tilt and float applied to a point (video px, before the push-in). */
function tilt(cam: Cam, X: number, Y: number) {
  const cx = cam.rect.x + cam.rect.w / 2 + cam.x;
  const cy = cam.rect.y + cam.rect.h / 2 + cam.y;
  let x = X - cx;
  let y = Y - cy;
  let z = 0;
  // CSS order: rotateX then rotateY, applied right to left (Y first)
  const ry = rad(cam.tiltY);
  const rx = rad(cam.tiltX);
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  const k = PERSPECTIVE / (PERSPECTIVE - z);
  return { x: cx + x * k, y: cy + y * k };
}

/** Where the push-in puts things: V = A + zoom * (P - F). */
function pushParams(cam: Cam) {
  const F = tilt(cam, cam.rect.x + cam.x + cam.fx * cam.s, cam.rect.y + cam.y + cam.fy * cam.s);
  const k = clamp01((cam.zoom - 1) / 0.45);
  const A = { x: lerp(F.x, ANCHOR.x, k), y: lerp(F.y, ANCHOR.y, k) };
  return { F, A };
}

/** A point on the phone's screen (CSS px from its top left) on the video frame. */
export function project(cam: Cam, sx: number, sy: number) {
  const P = tilt(cam, cam.rect.x + cam.x + sx * cam.s, cam.rect.y + cam.y + sy * cam.s);
  const { F, A } = pushParams(cam);
  return { x: A.x + cam.zoom * (P.x - F.x), y: A.y + cam.zoom * (P.y - F.y) };
}

/** A point of the page (surface CSS px) on the video frame. */
export const projectPage = (cam: Cam, px: number, py: number) => project(cam, px, py - cam.scroll);

/** A rectangle (surface or screen CSS px) on the video frame, as its bounding box. */
export function projectRect(cam: Cam, r: number[], on: "page" | "screen" = "page") {
  const oy = on === "page" ? cam.scroll : 0;
  const pts = [
    [r[0], r[1]],
    [r[0] + r[2], r[1]],
    [r[0], r[1] + r[3]],
    [r[0] + r[2], r[1] + r[3]],
  ].map(([x, y]) => project(cam, x, y - oy));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Video px per CSS px at the current push-in (the sharpness check: keep it under ~3.3). */
export const pixelScale = (cam: Cam) => cam.s * cam.zoom;

/** How fast the picture moves at frame f (video px per frame): drives the motion blur. */
export function speed(f: number, keys: CamKeys) {
  const a = camAt(f, keys);
  const b = camAt(Math.max(0, f - 1), keys);
  if (a.surface !== b.surface) return 0;
  const pa = project(a, VW / 2, a.viewH / 2);
  const pb = project(b, VW / 2, b.viewH / 2);
  const scrollPx = Math.abs(a.scroll - b.scroll) * a.s * a.zoom;
  return Math.hypot(pa.x - pb.x, pa.y - pb.y) + scrollPx + Math.abs(a.zoom - b.zoom) * 900;
}

// ---- drawing -------------------------------------------------------------------------------------------------
/** The tall page: only the tiles near the screen are drawn. */
const Page: React.FC<{ cam: Cam }> = ({ cam }) => {
  const sf = SURFACES[cam.surface];
  const { s, scroll, viewH } = cam;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: VW * s, height: sf.height * s, transform: `translateY(${-scroll * s}px)` }}>
      {sf.tiles
        .filter((t) => t.y + t.h > scroll - 200 && t.y < scroll + viewH + 200)
        .map((t) => (
          <Img key={t.file} src={staticFile(t.file)} style={{ position: "absolute", left: 0, top: t.y * s, width: VW * s, height: t.h * s }} />
        ))}
    </div>
  );
};

/** The builder's live preview, pinned under the nav the way the site pins it on phones. */
function stageTop(cam: Cam) {
  const sf = SURFACES[cam.surface];
  const stageY = cam.surface === "home" ? sf.sections.builder[1] + 264.8 : sf.boxes.stage[1];
  const gridEnd = cam.surface === "home" ? sf.sections.builder[1] + sf.sections.builder[3] - 60 : sf.height - 60;
  const h = OVERLAYS[cam.stage]?.box[3] ?? 364;
  const natural = stageY - cam.scroll;
  return Math.min(Math.max(natural, STICK_TOP), gridEnd - h - cam.scroll);
}

const Stage: React.FC<{ cam: Cam }> = ({ cam }) => {
  const o = OVERLAYS[cam.stage];
  if (!o) return null;
  const top = stageTop(cam);
  if (top > cam.viewH || top + o.box[3] < 0) return null;
  return <Img src={staticFile(o.file)} style={{ position: "absolute", left: o.box[0] * cam.s, top: top * cam.s, width: o.box[2] * cam.s, height: o.box[3] * cam.s }} />;
};

const Nav: React.FC<{ cam: Cam }> = ({ cam }) => (
  <Img src={staticFile(OVERLAYS[cam.nav].file)} style={{ position: "absolute", left: 0, top: 0, width: VW * cam.s, height: NAV_H * cam.s }} />
);

const Drawer: React.FC<{ cam: Cam }> = ({ cam }) => {
  const d = cam.keys.drawer;
  if (!d || cam.drawer <= 0) return null;
  const info = DRAWERS[d.name];
  const p = cam.drawer;
  const clip = d.clipBottom ?? info.height;
  return (
    <>
      <AbsoluteFill style={{ background: `rgba(43,26,16,${0.5 * p})` }} />
      <div style={{ position: "absolute", top: 0, left: (1 - p) * VW * cam.s, width: info.width * cam.s, height: cam.viewH * cam.s, background: C.cream, borderLeft: `${2 * cam.s}px solid ${C.ink}`, overflow: "hidden", boxShadow: "-20px 0 40px rgba(43,26,16,.25)" }}>
        {/* the drawer as captured; `clipBottom` ends it early (the rest is its plain cream) */}
        <div style={{ position: "absolute", left: -2 * cam.s, top: 0, width: info.width * cam.s, height: clip * cam.s, overflow: "hidden" }}>
          <Img src={staticFile(info.file)} style={{ width: info.width * cam.s, height: info.height * cam.s, display: "block" }} />
        </div>
      </div>
    </>
  );
};

/** Taps and selections drawn on the screen: a press shade, a coral ring. */
const Marks: React.FC<{ cam: Cam }> = ({ cam }) => (
  <>
    {(cam.keys.marks ?? [])
      .filter((m) => cam.f >= m.from && cam.f < m.to)
      .map((m, i) => {
        const oy = (m.on ?? "page") === "page" ? cam.scroll : 0;
        const [x, y, w, h] = m.rect;
        const t = cam.f - m.from;
        if (m.kind === "press") {
          const k = t < 3 ? t / 3 : 1 - prog(cam.f, m.from + 3, m.to);
          return <div key={i} style={{ position: "absolute", left: x * cam.s, top: (y - oy) * cam.s, width: w * cam.s, height: h * cam.s, borderRadius: 10 * cam.s, background: `rgba(43,26,16,${0.22 * k})` }} />;
        }
        const k = Math.min(1, t / 5);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (x - 2) * cam.s,
              top: (y - oy - 2) * cam.s,
              width: (w + 4) * cam.s,
              height: (h + 4) * cam.s,
              borderRadius: 16 * cam.s,
              border: `${3 * cam.s}px solid ${C.coral}`,
              boxShadow: `0 ${4 * cam.s}px 0 ${C.coralDeep}`,
              opacity: k,
              transform: `scale(${1.12 - 0.12 * k})`,
            }}
          />
        );
      })}
  </>
);

/** The phone body around the screen: ink frame, side buttons, a soft shadow on the cream. */
const Body: React.FC<{ cam: Cam; children: React.ReactNode }> = ({ cam, children }) => {
  const r = cam.rect;
  const b = PHONE.bezel * (1 - cam.bleed);
  const rad = PHONE.radius * (1 - cam.bleed);
  const frame = 1 - cam.bleed;
  return (
    <div style={{ position: "absolute", left: r.x - b, top: r.y - b, width: r.w + 2 * b, height: r.h + 2 * b }}>
      {frame > 0.01 && (
        <>
          {/* the shadow on the cream: soft, warm, grounded */}
          <div style={{ position: "absolute", inset: 0, borderRadius: rad + b, boxShadow: `0 ${60 * frame}px ${110 * frame}px -30px rgba(43,26,16,${0.45 * frame}), 0 ${18 * frame}px ${30 * frame}px -12px rgba(43,26,16,${0.3 * frame})` }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: rad + b, background: `linear-gradient(145deg, #4a3b2e, ${C.ink} 40%, #1c140e)`, opacity: frame }} />
          {/* side buttons */}
          <div style={{ position: "absolute", right: -5 * frame, top: 260, width: 6, height: 120, borderRadius: 3, background: C.ink, opacity: frame }} />
          <div style={{ position: "absolute", left: -5 * frame, top: 220, width: 6, height: 70, borderRadius: 3, background: C.ink, opacity: frame }} />
          <div style={{ position: "absolute", left: -5 * frame, top: 310, width: 6, height: 70, borderRadius: 3, background: C.ink, opacity: frame }} />
        </>
      )}
      <div style={{ position: "absolute", left: b, top: b, width: r.w, height: r.h, borderRadius: Math.max(0, rad - 4), overflow: "hidden", background: C.cream }}>
        {children}
        {/* glass: a faint sheen across the screen */}
        {frame > 0.01 && <AbsoluteFill style={{ background: "linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,.07) 45%, rgba(255,255,255,0) 58%)", opacity: frame }} />}
      </div>
    </div>
  );
};

/** One frame of the phone, filmed. */
const Shot: React.FC<{ keys: CamKeys }> = ({ keys }) => {
  const f = useCurrentFrame();
  const cam = camAt(f, keys);
  const { F, A } = pushParams(cam);
  const cx = cam.rect.x + cam.rect.w / 2 + cam.x;
  const cy = cam.rect.y + cam.rect.h / 2 + cam.y;
  return (
    <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(${A.x - cam.zoom * F.x}px, ${A.y - cam.zoom * F.y}px) scale(${cam.zoom})` }}>
      <AbsoluteFill
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          transform: `translate(${cam.x}px, ${cam.y}px)`,
        }}
      >
        <AbsoluteFill style={{ perspective: PERSPECTIVE, perspectiveOrigin: `${cx - cam.x}px ${cy - cam.y}px` }}>
          <AbsoluteFill style={{ transformOrigin: `${cx - cam.x}px ${cy - cam.y}px`, transform: `rotateX(${cam.tiltX}deg) rotateY(${cam.tiltY}deg)` }}>
            <Body cam={cam}>
              <Page cam={cam} />
              <Marks cam={cam} />
              <Stage cam={cam} />
              <Nav cam={cam} />
              <Drawer cam={cam} />
            </Body>
          </AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * The phone, filmed by the camera. Fast moves get real camera motion blur
 * (several sub-frames blended); slow ones are drawn once.
 */
export const Camera: React.FC<{ keys: CamKeys; blurAbove?: number }> = ({ keys, blurAbove = 26 }) => {
  const f = useCurrentFrame();
  const v = Math.max(speed(f, keys), speed(f + 1, keys));
  // more sub-frames on the fastest moves, so the blur is a smear, not copies
  return v > blurAbove ? (
    <CameraMotionBlur shutterAngle={180} samples={v > 90 ? 14 : 9}>
      <Shot keys={keys} />
    </CameraMotionBlur>
  ) : (
    <Shot keys={keys} />
  );
};
