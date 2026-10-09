import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, SAFE, W } from "../theme";
import { Rosette } from "./Rosette";

/** A spring from 0 to 1 starting at `delay` frames. */
export function useIn(delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = { damping: 200 }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config });
}

/** 0 to 1 between two frames, eased. */
export function useRange(from: number, to: number) {
  const f = useCurrentFrame();
  const t = interpolate(f, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return t * t * (3 - 2 * t);
}

/** Words that rise into place one after another. */
export const Kinetic: React.FC<{ text: string; delay?: number; stagger?: number; style?: React.CSSProperties; accent?: number[] }> = ({
  text,
  delay = 0,
  stagger = 3,
  style,
  accent = [],
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <span style={{ display: "inline", ...style }}>
      {text.split(" ").map((word, i) => {
        const p = spring({ frame: f - delay - i * stagger, fps, config: { damping: 15, stiffness: 120, mass: 0.8 } });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              opacity: interpolate(p, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }),
              transform: `translateY(${(1 - p) * 46}px) rotate(${(1 - p) * 4}deg)`,
              color: accent.includes(i) ? C.coralDeep : undefined,
            }}
          >
            {word}
            {i < text.split(" ").length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
};

/** Eyebrow and headline at the top of the safe area. */
export const Caption: React.FC<{ eyebrow: string; headline: string; delay?: number; accent?: number[]; size?: number; top?: number }> = ({
  eyebrow,
  headline,
  delay = 4,
  accent,
  size = 74,
  top = SAFE.top + 24,
}) => {
  const e = useIn(delay);
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top, textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 16,
          fontFamily: F.body,
          fontWeight: 900,
          fontSize: 27,
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          color: C.coralDeep,
          opacity: e,
          transform: `translateY(${(1 - e) * 20}px)`,
          marginBottom: 18,
        }}
      >
        <Rosette size={34} rotate={e * 90} />
        {eyebrow}
        <Rosette size={34} rotate={-e * 90} />
      </div>
      <div style={{ fontFamily: F.title, fontSize: size, lineHeight: 1.08, color: C.ink, maxWidth: W - 140, margin: "0 auto" }}>
        <Kinetic text={headline} delay={delay + 6} accent={accent} />
      </div>
    </div>
  );
};

/** A row of rounded labels; `active` fills one, `done` marks the ones before. */
export const Pills: React.FC<{ items: readonly string[]; active: number; top: number; delay?: number; check?: boolean }> = ({ items, active, top, delay = 10, check = false }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 50, right: 50, top, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
      {items.map((label, i) => {
        const p = spring({ frame: f - delay - i * 3, fps, config: { damping: 16 } });
        const on = i === active;
        const done = check && i < active;
        return (
          <div
            key={label}
            style={{
              fontFamily: F.body,
              fontWeight: 800,
              fontSize: 27,
              padding: "11px 22px",
              borderRadius: 999,
              background: on ? C.ink : done ? C.tealTint : "rgba(255,253,248,.92)",
              color: on ? "#fff" : done ? "#0d5b51" : C.ink2,
              border: `2px solid ${on ? C.ink : done ? "rgba(34,164,147,.45)" : "rgba(43,26,16,.14)"}`,
              boxShadow: on ? "0 10px 24px -10px rgba(43,26,16,.6)" : "none",
              opacity: p,
              transform: `translateY(${(1 - p) * 24}px) scale(${on ? 1.06 : 1})`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {done && <span style={{ fontWeight: 900 }}>✓</span>}
            {label}
          </div>
        );
      })}
    </div>
  );
};

/** A floating card with a soft shadow. */
export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      position: "absolute",
      background: C.paper,
      borderRadius: 30,
      border: "1.5px solid rgba(43,26,16,.08)",
      boxShadow: "0 40px 80px -36px rgba(43,26,16,.5), 0 14px 30px -18px rgba(43,26,16,.3)",
      fontFamily: F.body,
      color: C.ink,
      ...style,
    }}
  >
    {children}
  </div>
);
