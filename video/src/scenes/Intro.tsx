import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Rosette } from "../components/Rosette";
import { Kinetic, useIn } from "../components/Text";
import { copy } from "../copy";
import { C, F } from "../theme";

// The logo on the brand's brown, a rosette turning in behind it, the name
// and the promise.
export const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const logo = useIn(4, { damping: 12, stiffness: 110 });
  const ros = useIn(0, { damping: 18, stiffness: 60 });
  const line = useIn(30);
  const kicker = useIn(52);
  return (
    <Background tone="brown">
      <div style={{ position: "absolute", left: 0, right: 0, top: 520, display: "flex", justifyContent: "center" }}>
        <Rosette
          size={600}
          rotate={interpolate(ros, [0, 1], [-120, 0]) + f * 0.15}
          color="rgba(232,103,74,.55)"
          accent="rgba(232,103,74,.85)"
          fill="rgba(42,28,19,.0)"
          style={{ position: "absolute", top: -64, opacity: ros, transform: `scale(${ros})` }}
        />
        <Img
          src={staticFile("logo.png")}
          style={{
            width: 420,
            height: 420,
            borderRadius: "50%",
            position: "relative",
            boxShadow: "0 0 0 8px rgba(250,241,226,.12), 0 40px 80px rgba(0,0,0,.45)",
            transform: `scale(${logo}) rotate(${(1 - logo) * -20}deg)`,
            opacity: Math.min(1, logo * 1.5),
          }}
        />
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 1080, textAlign: "center" }}>
        <div style={{ fontFamily: F.title, fontSize: 104, color: C.cream, lineHeight: 1 }}>
          <Kinetic text={copy.intro.brand} delay={16} stagger={5} />
        </div>
        <div
          style={{
            margin: "34px auto 30px",
            height: 0,
            width: 560 * line,
            borderTop: `4px dashed ${C.coral}`,
          }}
        />
        <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 52, color: C.cream, lineHeight: 1.2 }}>
          <Kinetic text={copy.intro.tagline} delay={34} stagger={3} accent={[4, 5]} />
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: F.body,
            fontWeight: 900,
            fontSize: 26,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: C.coral,
            opacity: kicker,
          }}
        >
          {copy.intro.kicker}
        </div>
      </div>
    </Background>
  );
};
