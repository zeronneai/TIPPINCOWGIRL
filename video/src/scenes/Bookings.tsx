import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Phone, Ring, Shot, Tap } from "../components/Phone";
import { Caption, Card, Pills, useIn } from "../components/Text";
import { ramp, stack, stepAt } from "../components/timeline";
import { copy } from "../copy";
import { box, demo } from "../shots";
import { C } from "../theme";

// A request sent from the site's form, then the same request in the list,
// on the board and on the calendar, where the months with bookings stand out.
const SHOTS = ["booking-form", "booking-sent", "bookings-list", "bookings-board", "calendar"];
const STARTS = [0, 54, 100, 152, 206];

export const Bookings: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = useIn(4, { damping: 18 });
  const op = stack(f, STARTS);
  const step = stepAt(f, [0, 100, 152, 206]);
  const months = spring({ frame: f - 236, fps, config: { damping: 14 } });
  return (
    <Background>
      <Caption eyebrow={copy.bookings.eyebrow} headline={copy.bookings.headline} accent={[3, 4]} />
      <Pills items={copy.bookings.steps} active={step} top={524} delay={16} check />
      <Phone x={470} top={606} height={1050} enter={phone} rotate={-1.5}>
        <Shot name="booking-form" opacity={op[0]}>
          <Ring box={box("booking-form", "submit")} p={ramp(f, 22, 32)} radius={10} />
        </Shot>
        <Shot name="booking-sent" opacity={op[1]} />
        <Shot name="bookings-list" opacity={op[2]}>
          <Ring box={box("bookings-list", "first")} p={ramp(f, 116, 126)} radius={18} />
        </Shot>
        <Shot name="bookings-board" opacity={op[3]}>
          <Ring box={box("bookings-board", "column")} p={ramp(f, 166, 176)} radius={18} />
        </Shot>
        <Shot name="calendar" opacity={op[4]}>
          <Ring box={box("calendar", "strip")} p={ramp(f, 218, 228)} radius={14} />
          <Ring box={box("calendar", "day")} p={ramp(f, 250, 258)} radius={10} />
        </Shot>
        <Tap box={box("booking-form", "submit")} at={44} />
      </Phone>

      <Card style={{ left: 642, width: 390, top: 1200, padding: "20px 22px", opacity: months, transform: `translateY(${(1 - months) * 80}px) rotate(2deg)` }}>
        <div style={{ fontWeight: 900, fontSize: 25, marginBottom: 14 }}>{copy.bookings.months}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {demo.months.map((m, i) => {
            const pop = spring({ frame: f - 244 - i * 2, fps, config: { damping: 12 } });
            const has = m.value > 0;
            return (
              <div
                key={m.key}
                style={{
                  borderRadius: 12,
                  padding: "8px 0 9px",
                  textAlign: "center",
                  background: has ? "#fff4ec" : "rgba(43,26,16,.04)",
                  border: `2px solid ${has ? "rgba(232,103,74,.5)" : "transparent"}`,
                  transform: `scale(${0.7 + pop * 0.3})`,
                  opacity: pop,
                }}
              >
                <div style={{ fontSize: 19, fontWeight: 800, color: has ? C.ink : C.muted }}>{m.label}</div>
                <div
                  style={{
                    margin: "5px auto 0",
                    width: 30,
                    lineHeight: "24px",
                    borderRadius: 999,
                    fontSize: 17,
                    fontWeight: 900,
                    background: has ? C.coralDeep : "rgba(43,26,16,.08)",
                    color: has ? "#fff" : C.muted,
                  }}
                >
                  {m.value}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </Background>
  );
};
