import React from "react";
import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Rosette } from "../components/Rosette";

// ---------------------------------------------------------------------------
// The ad's building blocks: timing on a musical grid, the layout for 9:16
// and 4:5, the palette, textures, light, and kinetic type.
// ---------------------------------------------------------------------------

export const FPS = 30;
/** Every cut lands on a beat of this tempo, so a track at this BPM syncs. */
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 15 frames
export const beats = (n: number) => Math.round(n * BEAT);

export const A = {
  night: "#140c07",
  leather: "#2a1c13",
  saddle: "#6b3f22",
  cream: "#faf1e2",
  creamDim: "rgba(250,241,226,.78)",
  coral: "#e8674a",
  coralDeep: "#b04e28",
  gold: "#e6c07a",
  goldLight: "#fdeec8",
  goldDeep: "#c49548",
};

export const FONT = {
  title: "'Alfa Slab One', Georgia, serif",
  serif: "'Playfair Display', 'Times New Roman', Georgia, serif",
  body: "'Satoshi', 'Helvetica Neue', Arial, sans-serif",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const lerp = (f: number, a: number, b: number, from = 0, to = 1) => interpolate(f, [a, b], [from, to], clamp);
export const ease = (f: number, a: number, b: number) => {
  const t = lerp(f, a, b);
  return t * t * (3 - 2 * t);
};

/**
 * Where things go. 9:16 keeps key text between y 250 and y 1570 (clear of
 * Reels and TikTok buttons); 4:5 (1080x1350) is a feed post, with its own
 * margins and a smaller hat.
 */
export function useLayout() {
  const { width, height } = useVideoConfig();
  const tall = height > 1600;
  return {
    W: width,
    H: height,
    tall,
    textTop: tall ? 300 : 92,
    textBottom: tall ? 1560 : 1270,
    hatSize: tall ? 900 : 640,
    hatY: tall ? 1030 : 700, // the hat's center
    title: tall ? 132 : 100,
    line: tall ? 86 : 66,
    phoneH: tall ? 940 : 760,
    phoneTop: tall ? 600 : 420,
  };
}

// ---- surfaces --------------------------------------------------------------------------------
/** Saddle leather, drifting slowly (parallax: it moves less than what is on it). */
export const Leather: React.FC<{ tint?: string; drift?: number; children?: React.ReactNode }> = ({ tint = "rgba(20,12,7,.35)", drift = 1, children }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: A.night, overflow: "hidden" }}>
      <Img
        src={staticFile("textures/leather.jpg")}
        style={{
          position: "absolute",
          width: width * 1.12,
          height: Math.max(height, (width * 1.12 * 1920) / 1080) * 1.0,
          left: -width * 0.06 + Math.sin(f / 90) * 14 * drift,
          top: -(Math.max(height, (width * 1.12 * 1920) / 1080) - height) / 2 + Math.cos(f / 110) * 18 * drift,
          objectFit: "cover",
        }}
      />
      <AbsoluteFill style={{ background: tint }} />
      {children}
    </AbsoluteFill>
  );
};

/** Moving film grain over everything. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const f = useCurrentFrame();
  const x = Math.floor(random(`gx${f}`) * 512);
  const y = Math.floor(random(`gy${f}`) * 512);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("textures/grain.png")})`,
        backgroundPosition: `${x}px ${y}px`,
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.6 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 85% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: "none" }} />
);

/** A warm light leak washing over a cut at `at` (frames of the whole ad). */
export const LightLeak: React.FC<{ at: number; len?: number; seed?: number }> = ({ at, len = 16, seed = 1 }) => {
  const f = useCurrentFrame();
  const t = f - at;
  if (t < -len / 2 || t > len) return null;
  const k = t < 0 ? lerp(t, -len / 2, 0) : 1 - lerp(t, 0, len);
  const x = 20 + random(`lx${seed}`) * 60 + t * 2.4;
  const y = 25 + random(`ly${seed}`) * 50;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", opacity: k * 0.7 }}>
      <AbsoluteFill style={{ background: `radial-gradient(40% 30% at ${x}% ${y}%, rgba(255,170,90,.85), rgba(232,103,74,.35) 45%, rgba(0,0,0,0) 75%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(30% 50% at ${100 - x}% ${100 - y}%, rgba(255,220,150,.55), rgba(0,0,0,0) 70%)` }} />
      <AbsoluteFill style={{ background: `rgba(255,236,200,${0.22 * Math.max(0, 1 - Math.abs(t) / 3)})` }} />
    </AbsoluteFill>
  );
};

// ---- type ---------------------------------------------------------------------------------------
/** Gold lettering with a slow shimmer running through it. */
export const Gold: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const f = useCurrentFrame();
  const x = (f * 2.2) % 300;
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(100deg, ${A.goldDeep} ${x - 160}%, ${A.goldLight} ${x - 120}%, ${A.gold} ${x - 90}%, ${A.goldDeep} ${x - 40}%, ${A.gold} ${x}%)`,
        backgroundSize: "100% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        filter: "drop-shadow(0 4px 18px rgba(0,0,0,.55))",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/**
 * Words revealed one by one from behind a mask (tight kinetic type).
 * `gold` lists the indexes of words set in gold.
 */
export const Words: React.FC<{
  text: string;
  at?: number;
  stagger?: number;
  gold?: number[];
  style?: React.CSSProperties;
  out?: number;
}> = ({ text, at = 0, stagger = 3, gold = [], style, out }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const gone = out == null ? 0 : ease(f, out, out + 8);
  return (
    <span style={{ display: "inline", ...style }}>
      {words.map((w, i) => {
        const p = spring({ frame: f - at - i * stagger, fps, config: { damping: 18, stiffness: 170, mass: 0.6 } });
        const y = (1 - p) * 105 - gone * 105;
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", padding: "0.08em 0.02em", margin: "-0.08em -0.02em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${y}%)`, whiteSpace: "pre" }}>
              {gold.includes(i) ? <Gold>{w}</Gold> : w}
              {i < words.length - 1 ? " " : ""}
            </span>
          </span>
        );
      })}
    </span>
  );
};

/** A small caps line between two gold rules, with a turning rosette. */
export const Kicker: React.FC<{ children: React.ReactNode; at?: number; style?: React.CSSProperties }> = ({ children, at = 0, style }) => {
  const f = useCurrentFrame();
  const p = ease(f, at, at + 12);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        fontFamily: FONT.body,
        fontWeight: 900,
        fontSize: 26,
        letterSpacing: "0.34em",
        textTransform: "uppercase",
        color: A.gold,
        opacity: p,
        ...style,
      }}
    >
      <span style={{ height: 2, width: 90 * p, background: `linear-gradient(90deg, rgba(216,178,106,0), ${A.gold})` }} />
      <Rosette size={30} rotate={f * 2} color={A.gold} accent={A.goldLight} fill={A.leather} />
      {children}
      <Rosette size={30} rotate={-f * 2} color={A.gold} accent={A.goldLight} fill={A.leather} />
      <span style={{ height: 2, width: 90 * p, background: `linear-gradient(270deg, rgba(216,178,106,0), ${A.gold})` }} />
    </div>
  );
};

/** A price label: a gold-edged pill. */
export const PricePill: React.FC<{ children: React.ReactNode; p?: number; style?: React.CSSProperties }> = ({ children, p = 1, style }) => (
  <div
    style={{
      display: "inline-block",
      fontFamily: FONT.body,
      fontWeight: 800,
      fontSize: 42,
      color: A.cream,
      padding: "14px 36px",
      borderRadius: 999,
      border: `2px solid ${A.gold}`,
      background: "rgba(20,12,7,.55)",
      boxShadow: "0 18px 40px -18px rgba(0,0,0,.8), inset 0 0 0 1px rgba(243,223,174,.15)",
      opacity: p,
      transform: `translateY(${(1 - p) * 30}px) scale(${0.9 + p * 0.1})`,
      ...style,
    }}
  >
    {children}
  </div>
);
