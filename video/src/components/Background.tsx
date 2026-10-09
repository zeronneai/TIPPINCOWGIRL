import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Rosette } from "./Rosette";

// Cream paper with the site's dot grid, a warm glow, a faint rosette turning
// slowly in the corner and a stitched border, like a hatband.
export const Background: React.FC<{ tone?: "cream" | "brown"; children?: React.ReactNode }> = ({ tone = "cream", children }) => {
  const f = useCurrentFrame();
  const brown = tone === "brown";
  return (
    <AbsoluteFill style={{ background: brown ? C.brown : C.cream, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${brown ? "rgba(250,241,226,.07)" : "rgba(43,26,16,.08)"} 1.6px, transparent 1.7px)`,
          backgroundSize: "34px 34px",
        }}
      />
      <AbsoluteFill
        style={{
          background: brown
            ? "radial-gradient(70% 45% at 50% 42%, rgba(232,103,74,.22) 0%, rgba(42,28,19,0) 70%)"
            : "radial-gradient(80% 50% at 50% 38%, rgba(253,227,218,.9) 0%, rgba(250,241,226,0) 70%)",
        }}
      />
      <Rosette
        size={760}
        rotate={f * 0.12}
        color={brown ? "rgba(250,241,226,.05)" : "rgba(176,78,40,.06)"}
        accent={brown ? "rgba(232,103,74,.08)" : "rgba(232,103,74,.07)"}
        fill="transparent"
        style={{ position: "absolute", right: -300, bottom: -260 }}
      />
      <div
        style={{
          position: "absolute",
          inset: 34,
          borderRadius: 46,
          border: `3px dashed ${brown ? "rgba(232,103,74,.35)" : "rgba(176,78,40,.22)"}`,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};
