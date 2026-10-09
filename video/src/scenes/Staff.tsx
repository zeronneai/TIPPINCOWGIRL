import React from "react";
import { Background } from "../components/Background";
import { Phone, Ring, Shot } from "../components/Phone";
import { Caption, Card, useIn } from "../components/Text";
import { ramp, stack } from "../components/timeline";
import { useCurrentFrame } from "remotion";
import { copy } from "../copy";
import { box } from "../shots";
import { C } from "../theme";

// Phone first, owner and staff roles, a private sign in.
const ICONS = [
  // phone
  "M7 2.5h10a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V4A1.5 1.5 0 0 1 7 2.5zM10.5 18.5h3",
  // people
  "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.5a3 3 0 0 1 0 6M18 14.5c1.9.7 3.1 2.5 3.5 5.5",
  // lock
  "M6 10.5h12a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1zM8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v3",
];
const TINTS = [
  [C.coralTint, C.coralDeep],
  [C.tealTint, "#0d5b51"],
  ["#dfe8f5", "#22416d"],
];

const Badge: React.FC<{ i: number; label: string }> = ({ i, label }) => {
  const p = useIn(20 + i * 10, { damping: 13 });
  return (
    <Card style={{ left: 584, width: 436, top: 700 + i * 200, padding: "26px 26px", display: "flex", alignItems: "center", gap: 22, opacity: p, transform: `translateX(${(1 - p) * 140}px)` }}>
      <div style={{ width: 84, height: 84, borderRadius: 24, display: "grid", placeItems: "center", background: TINTS[i][0], color: TINTS[i][1], flex: "none" }}>
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONS[i]} />
        </svg>
      </div>
      <div style={{ fontWeight: 900, fontSize: 34, lineHeight: 1.15 }}>{label}</div>
    </Card>
  );
};

export const Staff: React.FC = () => {
  const f = useCurrentFrame();
  const phone = useIn(4, { damping: 18 });
  const op = stack(f, [0, 52]);
  return (
    <Background>
      <Caption eyebrow={copy.staff.eyebrow} headline={copy.staff.headline} accent={[3]} />
      <Phone x={318} top={560} height={1000} enter={phone} rotate={-1.5}>
        <Shot name="signin" opacity={op[0]}>
          <Ring box={box("signin", "form")} p={ramp(f, 14, 24) * (1 - ramp(f, 46, 52))} radius={20} />
        </Shot>
        <Shot name="account" opacity={op[1]}>
          <Ring box={box("account", "menu")} p={ramp(f, 62, 72)} radius={16} />
        </Shot>
      </Phone>
      {copy.staff.badges.map((label, i) => (
        <Badge key={label} i={i} label={label} />
      ))}
    </Background>
  );
};
