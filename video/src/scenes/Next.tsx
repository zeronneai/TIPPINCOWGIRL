import React from "react";
import { Background } from "../components/Background";
import { Rosette } from "../components/Rosette";
import { Caption, Card, useIn } from "../components/Text";
import { copy } from "../copy";
import { C } from "../theme";

// What is planned. Labeled as upcoming on every line: none of it is
// available yet.
const Row: React.FC<{ i: number; label: string }> = ({ i, label }) => {
  const p = useIn(26 + i * 6, { damping: 15 });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "34px 6px",
        borderTop: i ? "2px dashed rgba(43,26,16,.12)" : "none",
        opacity: p,
        transform: `translateX(${(1 - p) * 60}px)`,
      }}
    >
      <Rosette size={58} rotate={p * 120} />
      <div style={{ fontWeight: 800, fontSize: 44, flex: 1 }}>{label}</div>
      <div
        style={{
          fontWeight: 900,
          fontSize: 24,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "#6e4b00",
          background: "#faefcf",
          border: "2px solid rgba(224,165,38,.6)",
          borderRadius: 999,
          padding: "7px 16px",
        }}
      >
        {copy.next.soon}
      </div>
    </div>
  );
};

export const Next: React.FC = () => {
  const note = useIn(16);
  const card = useIn(18, { damping: 18 });
  return (
    <Background>
      <Caption eyebrow={copy.next.eyebrow} headline={copy.next.headline} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 470, display: "flex", justifyContent: "center", opacity: note }}>
        <div style={{ fontWeight: 800, fontSize: 28, color: C.ink2, border: "2px dashed rgba(43,26,16,.3)", borderRadius: 999, padding: "10px 26px", fontFamily: "inherit" }}>
          {copy.next.note}
        </div>
      </div>
      <Card style={{ left: 110, right: 110, top: 610, padding: "16px 38px", opacity: card, transform: `translateY(${(1 - card) * 80}px)`, border: "3px dashed rgba(176,78,40,.3)" }}>
        {copy.next.items.map((label, i) => (
          <Row key={label} i={i} label={label} />
        ))}
      </Card>
    </Background>
  );
};
