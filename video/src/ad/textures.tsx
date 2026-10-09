import React from "react";
import { AbsoluteFill } from "remotion";

// Generators for the ad's two textures, rendered once with
// `npm run textures` into public/textures/ (small files, committed):
//
//   leather.jpg  pebbled saddle leather in the brand's browns, 1080x1920
//   grain.png    a transparent film grain tile, 512x512
//
// SVG lighting filters are too slow to run on every frame, so the ad uses
// these still images and moves them instead.

export const LeatherTexture: React.FC = () => (
  <AbsoluteFill style={{ background: "#2a1c13" }}>
    <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none">
      <defs>
        {/* broad mottling, like oiled leather */}
        <filter id="mottle" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.0035" numOctaves="3" seed="11" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.10  0 0 0 0 0.06  0 0 0 0 0.035  0 0 0 0.8 -0.25" />
        </filter>
        {/* the pebble grain, embossed by a low light */}
        <filter id="pebble" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="4" result="n" />
          <feDiffuseLighting in="n" surfaceScale="2.6" lightingColor="#ffe2bf" diffuseConstant="1.05" result="lit">
            <feDistantLight azimuth="235" elevation="52" />
          </feDiffuseLighting>
          <feColorMatrix in="lit" type="matrix" values="0.25 0 0 0 0  0.155 0 0 0 0  0.095 0 0 0 0  0 0 0 0 1" />
        </filter>
        <radialGradient id="glow" cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor="#8a5530" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#2a1c13" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vig" cx="50%" cy="50%" r="75%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.65" />
        </radialGradient>
      </defs>
      <rect width="1080" height="1920" filter="url(#pebble)" />
      <rect width="1080" height="1920" filter="url(#mottle)" style={{ mixBlendMode: "multiply" }} />
      <rect width="1080" height="1920" fill="url(#glow)" style={{ mixBlendMode: "screen" }} />
      <rect width="1080" height="1920" fill="url(#vig)" />
    </svg>
  </AbsoluteFill>
);

export const GrainTexture: React.FC = () => (
  <AbsoluteFill style={{ background: "transparent" }}>
    <svg width="512" height="512">
      <filter id="g" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.94  0 0 0 0 0.86  0 0 0 2.2 -1.05" />
      </filter>
      <rect width="512" height="512" filter="url(#g)" />
    </svg>
  </AbsoluteFill>
);
