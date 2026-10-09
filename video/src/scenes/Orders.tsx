import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Phone, Ring, Shot, Tap } from "../components/Phone";
import { Caption, Card, useIn } from "../components/Text";
import { during, ramp, stack } from "../components/timeline";
import { copy } from "../copy";
import { box, demo } from "../shots";
import { C, F } from "../theme";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Checkout on the site, the thank you page, then the same order waiting in
// the portal, announced by a notification.
const SHOTS = ["cart", "order-confirmed", "orders"];
const STARTS = [0, 66, 118];

export const Orders: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = useIn(4, { damping: 18 });
  const op = stack(f, STARTS);
  const toast = spring({ frame: f - 134, fps, config: { damping: 13, stiffness: 120 } });
  const toastOut = ramp(f, 214, 228);
  const paid = during(f, 74, 116);
  const o = demo.firstOrder;
  return (
    <Background>
      <Caption eyebrow={copy.orders.eyebrow} headline={copy.orders.headline} accent={[4, 5]} size={70} />
      <Phone x={540} top={606} height={1050} enter={phone}>
        <Shot name="cart" opacity={op[0]}>
          <Ring box={box("cart", "checkout")} p={ramp(f, 26, 36) * (1 - ramp(f, 60, 66))} radius={10} />
        </Shot>
        <Shot name="order-confirmed" opacity={op[1]} />
        <Shot name="orders" opacity={op[2]}>
          <Ring box={box("orders", "first")} p={ramp(f, 150, 160)} radius={20} />
        </Shot>
        <Tap box={box("cart", "checkout")} at={52} />
      </Phone>

      {/* "Paid" stamp while the thank you page shows */}
      <div
        style={{
          position: "absolute",
          left: 720,
          top: 700,
          transform: `rotate(-10deg) scale(${0.6 + paid * 0.4})`,
          opacity: paid,
          fontFamily: F.title,
          fontSize: 58,
          color: C.teal,
          border: `6px solid ${C.teal}`,
          borderRadius: 18,
          padding: "6px 26px",
          background: "rgba(255,253,248,.92)",
          boxShadow: "0 20px 40px -20px rgba(43,26,16,.5)",
        }}
      >
        {copy.orders.paid} ✓
      </div>

      {/* the notification for the new order */}
      <Card
        style={{
          left: 150,
          right: 150,
          top: 640,
          padding: "22px 26px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          opacity: toast * (1 - toastOut),
          transform: `translateY(${(1 - toast) * -140 - toastOut * 40}px) scale(${0.9 + toast * 0.1})`,
        }}
      >
        <div style={{ width: 64, height: 64, borderRadius: 18, background: C.coralTint, display: "grid", placeItems: "center", color: C.coralDeep, fontSize: 34, fontWeight: 900, flex: "none" }}>
          $
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: ".14em", textTransform: "uppercase", color: C.coralDeep }}>{copy.orders.toastTitle}</div>
          <div style={{ fontWeight: 900, fontSize: 34 }}>{o.name}</div>
          <div style={{ fontWeight: 500, fontSize: 27, color: C.muted }}>
            {money(o.total)} · {o.hats} {o.hats === 1 ? "hat" : "hats"}
          </div>
        </div>
      </Card>
    </Background>
  );
};
