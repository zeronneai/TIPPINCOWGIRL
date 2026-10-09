import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Phone, Ring, Shot, Tap } from "../components/Phone";
import { Caption, Card, Pills, useIn } from "../components/Text";
import { stack, stepAt } from "../components/timeline";
import { copy } from "../copy";
import { box, shot } from "../shots";
import { C, F } from "../theme";

// The site, then the builder: wool, suede and straw, accessories, engraving,
// with the live preview floating beside the phone.
const SHOTS = ["site-hero", "builder-wool", "builder-suede", "builder-straw", "builder-accessories", "builder-engraving"];
const STARTS = [0, 58, 108, 152, 196, 244];
const PREVIEWS = ["preview-wool", "preview-suede", "preview-straw", "preview-accessories", "preview-engraving"];

export const Shop: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = useIn(6, { damping: 18 });
  const op = stack(f, STARTS);
  const step = stepAt(f, STARTS.slice(1));
  const card = spring({ frame: f - 66, fps, config: { damping: 14 } });
  const bump = step >= 0 ? spring({ frame: f - STARTS[step + 1], fps, config: { damping: 9, stiffness: 180 } }) : 0;
  return (
    <Background>
      <Caption eyebrow={copy.shop.eyebrow} headline={copy.shop.headline} accent={[3, 4]} />
      <Pills items={copy.shop.steps} active={step} top={524} delay={40} check />
      <Phone x={410} top={606} height={1050} enter={phone} rotate={-2}>
        {SHOTS.map((name, i) => (
          <Shot key={name} name={name} opacity={op[i]}>
            {name === "builder-accessories" && <Ring box={box(name, "choice")} p={interpolate(f, [206, 214], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />}
            {name === "builder-engraving" && <Ring box={box(name, "stage")} p={interpolate(f, [256, 266], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} radius={22} />}
          </Shot>
        ))}
        <Tap box={box("builder-wool", "choice")} at={74} />
        <Tap box={box("builder-suede", "choice")} at={96} />
        <Tap box={box("builder-straw", "choice")} at={140} />
        <Tap box={box("builder-accessories", "choice")} at={204} />
      </Phone>
      <Card
        style={{
          left: 636,
          top: 1052,
          width: 400,
          padding: 18,
          opacity: card,
          transform: `translateY(${(1 - card) * 120}px) rotate(${3 - card}deg) scale(${1 + Math.sin(Math.min(1, bump) * Math.PI) * 0.05})`,
        }}
      >
        <div style={{ position: "relative", width: 364, height: 364, borderRadius: 20, overflow: "hidden", background: C.cream }}>
          {PREVIEWS.map((name, i) => {
            const o = i === 0 ? 1 : interpolate(f, [STARTS[i + 1], STARTS[i + 1] + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return o > 0 ? <Img key={name} src={staticFile(shot(name).file)} style={{ position: "absolute", inset: 0, width: 364, height: 364, opacity: o }} /> : null;
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, fontFamily: F.body, fontWeight: 900, fontSize: 26, color: C.ink }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: C.teal, boxShadow: `0 0 0 6px ${C.tealTint}` }} />
          {copy.shop.preview}
        </div>
      </Card>
    </Background>
  );
};
