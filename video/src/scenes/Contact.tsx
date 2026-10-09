import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Phone, Ring, Shot, Tap } from "../components/Phone";
import { Caption, Card, useIn } from "../components/Text";
import { ramp, stack } from "../components/timeline";
import { copy } from "../copy";
import { box, demo } from "../shots";
import { C } from "../theme";

// The booking's big WhatsApp and email buttons, and the ready made reply
// that opens with the customer's name and date filled in.
const SHOTS = ["booking-detail", "booking-templates"];
const STARTS = [0, 92];

const WhatsAppIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path
      fill="currentColor"
      d="M12 2.2A9.7 9.7 0 0 0 3.6 16.8L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 5 5 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3z"
    />
  </svg>
);

export const Contact: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = useIn(4, { damping: 18 });
  const op = stack(f, STARTS);
  const chat = spring({ frame: f - 60, fps, config: { damping: 15 } });
  const b = demo.booking;
  // the first sentences of the confirm message, typed out
  const message = b.confirmText.split("\n")[0];
  const typed = Math.round(interpolate(f, [70, 132], [0, message.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <Background>
      <Caption eyebrow={copy.contact.eyebrow} headline={copy.contact.headline} accent={[2, 3]} />
      <Phone x={350} top={560} height={1040} enter={phone} rotate={-2}>
        <Shot name="booking-detail" opacity={op[0]}>
          <Ring box={box("booking-detail", "buttons")} p={ramp(f, 18, 30)} radius={18} pad={8} />
        </Shot>
        <Shot name="booking-templates" opacity={op[1]}>
          <Ring box={box("booking-templates", "confirm")} p={ramp(f, 104, 114)} radius={16} />
        </Shot>
        <Tap box={box("booking-detail", "whatsapp")} at={48} />
        <Tap box={box("booking-templates", "whatsapp")} at={150} />
      </Phone>

      <Card style={{ left: 470, width: 560, top: 820, overflow: "hidden", opacity: chat, transform: `translateX(${(1 - chat) * 260}px) rotate(${2 * chat}deg)` }}>
        <div style={{ background: C.whatsapp, color: "#fff", padding: "18px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <WhatsAppIcon size={40} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 28 }}>{b.name}</div>
            <div style={{ fontWeight: 500, fontSize: 20, opacity: 0.85 }}>{copy.contact.prefilled}</div>
          </div>
        </div>
        <div style={{ background: "#efe7dc", padding: "22px 22px 26px", minHeight: 300 }}>
          <div
            style={{
              marginLeft: "auto",
              maxWidth: 470,
              background: "#dcf3d6",
              borderRadius: "20px 20px 6px 20px",
              padding: "18px 20px",
              fontSize: 26,
              lineHeight: 1.38,
              fontWeight: 500,
              color: C.ink,
              boxShadow: "0 2px 0 rgba(0,0,0,.06)",
              minHeight: 120,
            }}
          >
            {message.slice(0, typed)}
            <span style={{ opacity: f % 16 < 8 && typed < message.length ? 1 : 0 }}>|</span>
          </div>
          <div style={{ marginTop: 18, textAlign: "center", fontWeight: 700, fontSize: 23, color: C.ink2, lineHeight: 1.35, opacity: ramp(f, 120, 136) }}>
            {copy.contact.note}
          </div>
        </div>
      </Card>
    </Background>
  );
};
