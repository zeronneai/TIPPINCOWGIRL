import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Phone, Ring, Shot } from "../components/Phone";
import { Caption, Card, useIn } from "../components/Text";
import { ramp, stack } from "../components/timeline";
import { copy } from "../copy";
import { box, demo } from "../shots";
import { C } from "../theme";

// The dashboard in the phone; beside it the same numbers counting up and
// the bookings by month drawing in (from the demo data on the screenshot).
const SHOTS = ["dashboard-top", "dashboard-charts"];
const STARTS = [0, 128];

const Count: React.FC<{ to: number; delay: number; format?: (n: number) => string }> = ({ to, delay, format = (n) => String(Math.round(n)) }) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [delay, delay + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eased = 1 - Math.pow(1 - t, 3);
  return <>{format(to * eased)}</>;
};

const Stat: React.FC<{ top: number; delay: number; label: string; children: React.ReactNode; color: string }> = ({ top, delay, label, children, color }) => {
  const p = useIn(delay, { damping: 15 });
  return (
    <Card style={{ left: 584, width: 436, top, padding: "22px 28px", opacity: p, transform: `translateX(${(1 - p) * 120}px)`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 7, background: color }} />
      <div style={{ fontWeight: 800, fontSize: 23, letterSpacing: ".08em", textTransform: "uppercase", color: C.ink2 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 64, letterSpacing: "-0.02em", lineHeight: 1.1, marginTop: 6 }}>{children}</div>
    </Card>
  );
};

export const Dashboard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = useIn(4, { damping: 18 });
  const op = stack(f, STARTS);
  const k = demo.kpis;
  const months = demo.months;
  const max = Math.max(1, ...months.map((m) => m.value));
  const chart = useIn(92, { damping: 16 });
  return (
    <Background>
      <Caption eyebrow={copy.dashboard.eyebrow} headline={copy.dashboard.headline} accent={[3, 4]} size={70} />
      <Phone x={318} top={606} height={1000} enter={phone} rotate={-1.5}>
        <Shot name="dashboard-top" opacity={op[0]}>
          <Ring box={box("dashboard-top", "kpis")} p={ramp(f, 30, 42) * (1 - ramp(f, 118, 128))} radius={18} />
        </Shot>
        <Shot name="dashboard-charts" opacity={op[1]}>
          <Ring box={box("dashboard-charts", "weekly")} p={ramp(f, 150, 162)} radius={18} />
        </Shot>
      </Phone>

      <Stat top={612} delay={22} label={copy.dashboard.revenue} color={C.coralDeep}>
        <Count to={k.revenueMonth / 100} delay={30} format={(n) => `$${Math.round(n).toLocaleString("en-US")}`} />
      </Stat>
      <Stat top={790} delay={34} label={copy.dashboard.orders} color={C.coral}>
        <Count to={k.ordersMonth} delay={42} />
      </Stat>
      <Stat top={968} delay={46} label={copy.dashboard.bookings} color={C.amber}>
        <Count to={k.newBookings} delay={54} />
      </Stat>

      <Card style={{ left: 584, width: 436, top: 1150, height: 400, padding: "24px 26px", opacity: chart, transform: `translateY(${(1 - chart) * 80}px)` }}>
        <div style={{ fontWeight: 900, fontSize: 27 }}>{copy.dashboard.chart}</div>
        <div style={{ position: "absolute", left: 26, right: 26, bottom: 64, height: 230, display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTop: "2px solid rgba(43,26,16,.12)" }} />
          {months.map((m, i) => {
            const grow = spring({ frame: f - 104 - i * 3, fps, config: { damping: 14 } });
            const h = Math.max(4, (m.value / max) * 200) * grow;
            return (
              <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                {m.value > 0 && <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 6, opacity: grow }}>{m.value}</div>}
                <div style={{ width: "72%", height: h, borderRadius: "6px 6px 0 0", background: m.value ? C.teal : "rgba(43,26,16,.08)" }} />
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 26, right: 26, bottom: 22, display: "flex", gap: 8 }}>
          {months.map((m) => (
            <div key={m.key} style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: 700, color: C.muted }}>
              {m.label.charAt(0)}
            </div>
          ))}
        </div>
      </Card>
    </Background>
  );
};
