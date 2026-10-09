import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Rosette } from "../components/Rosette";
import { Kinetic, useIn } from "../components/Text";
import { copy } from "../copy";
import { C, F } from "../theme";

export const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const logo = useIn(2, { damping: 13 });
  const addr = useIn(22, { damping: 16 });
  return (
    <Background tone="brown">
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, display: "flex", justifyContent: "center" }}>
        <Rosette size={480} rotate={f * 0.3} color="rgba(232,103,74,.45)" accent="rgba(232,103,74,.8)" fill="transparent" style={{ position: "absolute", top: -60, opacity: logo }} />
        <Img src={staticFile("logo.png")} style={{ width: 360, height: 360, borderRadius: "50%", position: "relative", transform: `scale(${logo})`, boxShadow: "0 30px 60px rgba(0,0,0,.45)" }} />
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 1010, textAlign: "center" }}>
        <div style={{ fontFamily: F.title, fontSize: 92, color: C.cream, lineHeight: 1 }}>
          <Kinetic text={copy.outro.brand} delay={8} stagger={4} />
        </div>
        <div
          style={{
            display: "inline-block",
            marginTop: 40,
            fontFamily: F.body,
            fontWeight: 900,
            fontSize: 50,
            color: C.brown,
            background: C.coral,
            borderRadius: 999,
            padding: "14px 40px",
            opacity: addr,
            transform: `scale(${0.85 + addr * 0.15})`,
          }}
        >
          {copy.outro.address}
        </div>
        <div style={{ marginTop: 30, fontFamily: F.body, fontWeight: 700, fontSize: 30, color: "rgba(250,241,226,.75)", opacity: addr }}>{copy.outro.line}</div>
      </div>
    </Background>
  );
};
