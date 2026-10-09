import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Phone, Ring, Shot, Tap } from "../components/Phone";
import { Caption, Card, Pills, useIn } from "../components/Text";
import { ramp, stack, stepAt } from "../components/timeline";
import { copy } from "../copy";
import { box, demo } from "../shots";
import { C } from "../theme";

// An order with its hat drawn as it was built, the status moved to Shipped
// with a tracking number, and the history that keeps every step.
const SHOTS = ["order-detail", "order-status", "order-history"];
const STARTS = [0, 104, 204];
const STEP_STARTS = [0, 60, 128, 196];

export const Manage: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = useIn(4, { damping: 18 });
  const op = stack(f, STARTS);
  const tracking = spring({ frame: f - 198, fps, config: { damping: 13 } });
  return (
    <Background>
      <Caption eyebrow={copy.manage.eyebrow} headline={copy.manage.headline} accent={[4]} />
      <Pills items={copy.manage.steps} active={stepAt(f, STEP_STARTS)} top={524} delay={18} check />
      <Phone x={540} top={606} height={1050} enter={phone}>
        <Shot name="order-detail" opacity={op[0]} zoom={{ box: box("order-detail", "hat"), scale: 1.32, p: ramp(f, 24, 70) * (1 - ramp(f, 90, 104)) }}>
          <Ring box={box("order-detail", "hat")} p={ramp(f, 30, 42)} radius={18} />
        </Shot>
        <Shot name="order-status" opacity={op[1]}>
          <Ring box={box("order-status", "tracking")} p={ramp(f, 124, 134) * (1 - ramp(f, 168, 176))} radius={12} />
          <Ring box={box("order-status", "save")} p={ramp(f, 172, 180)} radius={12} />
        </Shot>
        <Shot name="order-history" opacity={op[2]}>
          <Ring box={box("order-history", "timeline")} p={ramp(f, 222, 234)} radius={14} pad={10} />
        </Shot>
        <Tap box={box("order-status", "save")} at={186} />
      </Phone>
      <Card
        style={{
          left: 120,
          right: 120,
          top: 1430,
          padding: "18px 26px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          opacity: tracking,
          transform: `translateY(${(1 - tracking) * 70}px)`,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: ".12em", textTransform: "uppercase", color: "#fff", background: C.navy, borderRadius: 999, padding: "8px 16px", flex: "none" }}>
          {copy.manage.tracking}
        </div>
        <div style={{ fontWeight: 800, fontSize: 30, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{demo.shippedOrder.tracking}</div>
      </Card>
    </Background>
  );
};
