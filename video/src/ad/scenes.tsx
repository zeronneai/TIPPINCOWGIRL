import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Phone, Ring, Shot, Tap } from "../components/Phone";
import { Rosette } from "../components/Rosette";
import { adCopy } from "../ad-copy";
import { FINISHED, MONTAGE, STRAW, SUEDE, WOOL, WOOL_ENGRAVING, type HatConfig } from "../ad-hats";
import { Hat } from "./Hat";
import { A, BEAT, FONT, Gold, Kicker, Leather, LightLeak, PricePill, Vignette, Words, ease, lerp, useLayout } from "./kit";
import { STARTING_PRICE, TYPE_PRICES, fill } from "./prices";
import { adBox, adShot } from "./shots";

// ---------------------------------------------------------------------------
// The ad's scenes. Each takes its length in frames (`dur`) and lays itself
// out for 9:16 or 4:5 (useLayout). Captions come from ad-copy.ts, hats from
// ad-hats.ts, prices from pricing.js (prices.ts).
// ---------------------------------------------------------------------------

type Scene = React.FC<{ dur: number }>;

const Center: React.FC<{ x?: number; y: number; size: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ x, y, size, style, children }) => {
  const { W } = useLayout();
  return <div style={{ position: "absolute", left: (x ?? W / 2) - size / 2, top: y - size / 2, width: size, height: size, ...style }}>{children}</div>;
};

const Title: React.FC<{ top: number; size: number; children: React.ReactNode; font?: string; style?: React.CSSProperties }> = ({ top, size, children, font = FONT.title, style }) => (
  <div style={{ position: "absolute", left: 60, right: 60, top, textAlign: "center", fontFamily: font, fontSize: size, lineHeight: 1.05, color: A.cream, textShadow: "0 6px 30px rgba(0,0,0,.45)", ...style }}>
    {children}
  </div>
);

// ---- 1. Hook: a hat assembles in a flash ------------------------------------------------------
export const Hook: Scene = ({ dur }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const pull = 1.22 - 0.22 * ease(f, 0, dur * 0.7);
  return (
    <Leather tint="rgba(14,8,4,.42)">
      <Center y={L.hatY + 20} size={L.hatSize} style={{ transform: `scale(${pull})` }}>
        <Hat config={WOOL} size={L.hatSize} assemble={{ start: 2, gap: 5 }} sweepAt={dur - 26} />
      </Center>
      <Vignette strength={0.55} />
      <Title top={L.textTop} size={L.title}>
        <div>
          <Words text={adCopy.hook.lines[0]} at={3} stagger={4} />
        </div>
        <div>
          <Words text={adCopy.hook.lines[1]} at={16} stagger={4} gold={[1]} />
        </div>
      </Title>
    </Leather>
  );
};

// ---- 2. Desire: the site's own cowgirl, and the promise --------------------------------------------
export const Desire: Scene = ({ dur }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const { fps } = useVideoConfig();
  const phone = spring({ frame: f - 4, fps, config: { damping: 18, stiffness: 90 } });
  const lineSize = L.tall ? 82 : 62;
  const phoneTop = L.tall ? 700 : 400;
  const phoneH = L.tall ? 860 : 830;
  const drift = f / dur;
  return (
    <Leather tint="rgba(14,8,4,.5)" drift={1.6}>
      {/* depth: two finished hats floating behind, slower than the phone */}
      <Center x={L.tall ? 170 : 150} y={(L.tall ? 1330 : 1010) - drift * 50} size={L.tall ? 440 : 360} style={{ opacity: 0.85 * phone, filter: "blur(1.5px)", transform: "rotate(-10deg)" }}>
        <Hat config={SUEDE} size={L.tall ? 440 : 360} shadow={false} />
      </Center>
      <Center x={L.tall ? 920 : 935} y={(L.tall ? 860 : 520) - drift * 80} size={L.tall ? 400 : 330} style={{ opacity: 0.85 * phone, filter: "blur(1.5px)", transform: "rotate(9deg)" }}>
        <Hat config={STRAW} size={L.tall ? 400 : 330} shadow={false} />
      </Center>
      <Phone x={540} top={phoneTop} height={phoneH} enter={phone} rotate={-3 + drift * 2}>
        <Shot name="hero" info={adShot("hero")} zoom={{ box: [40, 140, 310, 420], scale: 1.16, p: ease(f, 0, dur) }} />
      </Phone>
      <Vignette strength={0.5} />
      <Title top={L.textTop - (L.tall ? 10 : 0)} size={lineSize} font={FONT.serif} style={{ fontStyle: "italic", lineHeight: 1.12, left: 80, right: 80 }}>
        <Words text={adCopy.desire.line} at={8} stagger={3} gold={[adCopy.desire.line.split(" ").length - 1]} />
      </Title>
    </Leather>
  );
};

// ---- 3. The builder: the real site in a phone, then the three hat types ------------------------------
const PHONE_SHOTS = ["type-wool", "color", "feather", "bud", "engraving", "size", "cart"] as const;
const TAP_KEY: Record<string, string> = { "type-wool": "choice", color: "choice", feather: "choice", bud: "choice", engraving: "add", size: "choice", cart: "checkout" };

export const Builder: Scene = ({ dur }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const { fps } = useVideoConfig();
  // the phone part, then the three types if there is room for them
  const split = dur >= 200 ? Math.round(dur / 2 / BEAT) * BEAT : dur;
  const per = Math.max(BEAT, Math.floor(split / PHONE_SHOTS.length / BEAT) * BEAT);
  const shown = PHONE_SHOTS.slice(0, Math.min(PHONE_SHOTS.length, Math.floor(split / per)));
  const idx = Math.min(shown.length - 1, Math.floor(f / per));
  const phone = spring({ frame: f, fps, config: { damping: 17, stiffness: 120 } });
  const inTypes = f >= split;
  const t = f - split;

  if (!inTypes) {
    const name = shown[idx];
    const local = f - idx * per;
    const labelP = ease(local, 0, 6);
    const phoneTop = L.tall ? 560 : 330;
    const phoneH = L.tall ? 980 : 900;
    return (
      <Leather tint="rgba(14,8,4,.5)">
        <Title top={L.textTop} size={L.tall ? 84 : 66} style={{ whiteSpace: "nowrap", left: 30, right: 30 }}>
          <Words text={adCopy.builder.line} at={2} stagger={3} gold={[adCopy.builder.line.split(" ").length - 1]} />
        </Title>
        <div style={{ position: "absolute", left: 0, right: 0, top: L.textTop + (L.tall ? 118 : 88), opacity: labelP, transform: `translateY(${(1 - labelP) * 10}px)` }}>
          <Kicker>{adCopy.builder.steps[name]}</Kicker>
        </div>
        <Phone x={540} top={phoneTop} height={phoneH} enter={phone} rotate={Math.sin(f / 20) * 0.8}>
          {shown.map((s, i) => {
            const o = i === idx ? (i === 0 ? 1 : ease(f - i * per, 0, 4)) : i === idx - 1 ? 1 : 0;
            if (!o) return null;
            const zoomOn = s === "engraving" || s === "size" || s === "cart" ? null : adBox(s, "stage");
            return (
              <Shot key={s} name={s} info={adShot(s)} opacity={o} zoom={zoomOn ? { box: zoomOn, scale: 1.08, p: ease(f - i * per, 2, per) } : undefined}>
                {i === idx && <Ring box={adBox(s, TAP_KEY[s])} p={ease(local, 4, 9)} radius={12} />}
              </Shot>
            );
          })}
          <Tap box={adBox(name, TAP_KEY[name])} at={idx * per + 5} />
        </Phone>
        <Vignette strength={0.45} />
      </Leather>
    );
  }

  // Wool. Faux suede. Straw. One hat per word, match cut in the same spot.
  const hats: HatConfig[] = [WOOL, SUEDE, STRAW];
  const each = Math.floor((dur - split) / 3);
  const k = Math.min(2, Math.floor(t / each));
  const local = t - k * each;
  const words = adCopy.builder.types.split(" ");
  // which words belong to which hat: "Wool." "Faux suede." "Straw."
  const groups = [[0], [1, 2], [3]];
  const price = TYPE_PRICES.find((p) => p.id === hats[k].hatType)!;
  const pop = spring({ frame: local, fps, config: { damping: 12, stiffness: 160 } });
  return (
    <Leather tint="rgba(14,8,4,.45)">
      <Title top={L.textTop} size={L.tall ? 104 : 80}>
        {words.map((w, i) => {
          const g = groups.findIndex((gr) => gr.includes(i));
          const on = g <= k;
          const now = g === k;
          return (
            <span key={i} style={{ opacity: on ? 1 : 0.18, display: "inline-block", transform: `translateY(${now ? (1 - pop) * 20 : 0}px)`, marginRight: "0.25em" }}>
              {now ? <Gold>{w}</Gold> : w}
            </span>
          );
        })}
      </Title>
      <Center y={L.hatY + (L.tall ? 40 : 30)} size={L.hatSize} style={{ transform: `scale(${0.94 + pop * 0.06})` }}>
        <Hat key={k} config={hats[k]} size={L.hatSize} sweepAt={6} />
      </Center>
      <div style={{ position: "absolute", left: 0, right: 0, top: L.hatY + L.hatSize * (L.tall ? 0.36 : 0.37), textAlign: "center" }}>
        <PricePill p={ease(local, 4, 12)}>{fill(adCopy.builder.from, price.from)}</PricePill>
      </div>
      <Vignette strength={0.55} />
      {local < 4 && <AbsoluteFill style={{ background: `rgba(255,236,200,${0.28 * (1 - local / 4)})`, mixBlendMode: "screen" }} />}
    </Leather>
  );
};

// ---- 4. Stack your style: a piece swapped on every beat ----------------------------------------------
export const Stack: React.FC<{ dur: number; entries?: number[] }> = ({ dur, entries }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const list = (entries ?? MONTAGE.map((_, i) => i)).map((i) => MONTAGE[i]);
  const i = Math.min(list.length - 1, Math.floor(f / BEAT));
  const cur = list[i];
  const prev = i > 0 ? list[i - 1] : undefined;
  const local = f - i * BEAT;
  const punch = 1 + 0.045 * Math.max(0, 1 - local / 6);
  // where this word's run of beats started, for its reveal
  const wordStart = list.findIndex((e) => e.word === cur.word) * BEAT;
  const isLine = cur.word >= adCopy.stack.words.length;
  const caption = isLine ? adCopy.stack.line : adCopy.stack.words[cur.word];
  const rail = L.tall ? 150 : 118;
  const railTop = L.tall ? 1385 : 1100;
  const hatY = L.tall ? L.hatY - 20 : L.hatY - 30;
  const tint = ["rgba(14,8,4,.45)", "rgba(40,10,10,.45)", "rgba(10,18,14,.45)", "rgba(6,6,14,.5)", "rgba(14,8,4,.4)"][Math.min(4, cur.word)];
  return (
    <Leather tint={tint} drift={2}>
      <Center y={hatY} size={L.hatSize} style={{ transform: `scale(${punch})` }}>
        <Hat config={cur.hat} size={L.hatSize} prev={prev?.hat} changeAt={i * BEAT} sweepAt={isLine ? wordStart + 6 : undefined} />
      </Center>
      <Vignette strength={0.55} />
      <Title top={L.textTop} size={isLine ? (L.tall ? 112 : 86) : L.tall ? 128 : 96}>
        <Words key={caption} text={caption} at={wordStart} stagger={3} gold={isLine ? [2] : [0]} />
      </Title>
      {/* the builder's own thumbnails, rolling past with the beat */}
      <div style={{ position: "absolute", top: railTop, left: 0, right: 0, height: rail + 20, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: 10,
            left: L.W / 2 - rail / 2,
            display: "flex",
            gap: 18,
            // the current thumbnail slides to the middle on its beat
            transform: `translateX(${-(i > 0 ? i - 1 + ease(local, 0, 6) : 0) * (rail + 18)}px)`,
          }}
        >
          {list.map((e, j) => (
            <div
              key={j}
              style={{
                width: rail,
                height: rail,
                flex: "none",
                borderRadius: 22,
                overflow: "hidden",
                border: `3px solid ${j === i ? A.gold : "rgba(250,241,226,.18)"}`,
                boxShadow: j === i ? `0 0 0 6px rgba(216,178,106,.18), 0 20px 40px -20px rgba(0,0,0,.8)` : "none",
                transform: `scale(${j === i ? 1.06 : 0.9})`,
                opacity: Math.abs(j - i) > 3 ? 0 : j === i ? 1 : 0.55,
              }}
            >
              <Img src={staticFile(`ad/thumbs/${e.thumb}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
        </div>
      </div>
    </Leather>
  );
};

// ---- 5. Make it personal: the engraving burns in ---------------------------------------------------
export const Personal: Scene = ({ dur }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  // push in on the front of the crown, where the initials go
  const z = ease(f, 0, 34);
  const scale = 1 + z * (L.tall ? 0.55 : 0.45);
  const fx = 589 / 1600;
  const fy = 674 / 1600;
  const hatSize = L.hatSize;
  const dx = (0.5 - fx) * hatSize * z * scale * 0.9;
  const dy = (0.5 - fy) * hatSize * z * scale * 0.6;
  return (
    <Leather tint="rgba(14,8,4,.5)" drift={0.6}>
      <Center y={L.hatY + (L.tall ? 60 : 50)} size={hatSize} style={{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }}>
        <Hat config={{ ...WOOL, engraving: WOOL_ENGRAVING }} size={hatSize} engraveAt={Math.round(dur * 0.28)} sweepAt={Math.round(dur * 0.62)} />
      </Center>
      <Vignette strength={0.6} />
      <div style={{ position: "absolute", left: 0, right: 0, top: L.textTop }}>
        <Kicker at={2}>{adCopy.personal.tag}</Kicker>
      </div>
      <Title top={L.textTop + (L.tall ? 70 : 56)} size={L.tall ? 96 : 72}>
        <Words text={adCopy.personal.line} at={8} stagger={3} gold={[adCopy.personal.line.split(" ").length - 1]} />
      </Title>
    </Leather>
  );
};

// ---- 6. Payoff: three finished hats, and they tip ---------------------------------------------------
export const Payoff: Scene = ({ dur }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const { fps } = useVideoConfig();
  const tipAt = Math.round(dur * 0.5);
  const tip = spring({ frame: f - tipAt, fps, config: { damping: 9, stiffness: 120 } });
  const tipBack = spring({ frame: f - tipAt - 14, fps, config: { damping: 12, stiffness: 90 } });
  const tilt = -11 * (tip - tipBack);
  const center = L.tall ? 600 : 470;
  const side = L.tall ? 470 : 380;
  const y = L.tall ? 930 : 650;
  const slots = [
    { x: L.tall ? 225 : 215, y: y + (L.tall ? 230 : 150), size: side, from: -500, z: 1 },
    { x: 540, y, size: center, from: 0, z: 2 },
    { x: L.tall ? 855 : 865, y: y + (L.tall ? 230 : 150), size: side, from: 500, z: 1 },
  ];
  return (
    <Leather tint="rgba(14,8,4,.42)">
      {FINISHED.map((h, i) => {
        const s = slots[i];
        const p = spring({ frame: f - 2 - i * 4, fps, config: { damping: 16, stiffness: 110 } });
        return (
          <Center key={i} x={s.x + (1 - p) * s.from} y={s.y + (1 - p) * (i === 1 ? 160 : 0)} size={s.size} style={{ zIndex: s.z, opacity: p, transform: `rotate(${tilt}deg) translateY(${-8 * (tip - tipBack)}px)`, transformOrigin: "50% 80%" }}>
            <Hat config={h} size={s.size} sweepAt={tipAt + i * 3} />
          </Center>
        );
      })}
      <Vignette strength={0.55} />
      <Title top={L.textTop} size={L.tall ? 84 : 64}>
        <Words text={adCopy.payoff.line} at={4} stagger={3} />
      </Title>
      <Title top={L.tall ? 1370 : 1105} size={L.tall ? 150 : 110}>
        <Words text={adCopy.payoff.punch} at={tipAt - 4} stagger={4} gold={[0, 1]} />
      </Title>
    </Leather>
  );
};

// ---- 7. CTA: the address, the starting price, the button --------------------------------------------
export const Cta: Scene = ({ dur }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: f, fps, config: { damping: 12, stiffness: 120 } });
  const btn = spring({ frame: f - 10, fps, config: { damping: 12 } });
  const pulse = 1 + 0.04 * Math.max(0, Math.cos(((f % BEAT) / BEAT) * Math.PI * 2));
  const u = L.tall ? 1 : 0.8;
  const top = L.tall ? 330 : 90;
  return (
    <Leather tint="rgba(14,8,4,.38)">
      <AbsoluteFill style={{ border: `3px solid rgba(216,178,106,.55)`, margin: 40, borderRadius: 44 }} />
      <AbsoluteFill style={{ border: `1px solid rgba(216,178,106,.35)`, margin: 54, borderRadius: 36 }} />
      <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ position: "relative", width: 420 * u, height: 420 * u, display: "grid", placeItems: "center" }}>
          <Rosette size={420 * u} rotate={f * 0.8} color={A.gold} accent={A.goldLight} fill="transparent" style={{ position: "absolute", opacity: 0.7 * logo }} />
          <Img src={staticFile("logo.png")} style={{ width: 290 * u, height: 290 * u, borderRadius: "50%", transform: `scale(${logo})`, boxShadow: "0 30px 60px rgba(0,0,0,.55)" }} />
        </div>
        <div style={{ marginTop: 30 * u, fontFamily: FONT.serif, fontStyle: "italic", fontSize: 58 * u, color: A.creamDim }}>
          <Words text={adCopy.cta.line} at={4} stagger={2} />
        </div>
        <div style={{ fontFamily: FONT.title, fontSize: 92 * u, lineHeight: 1.1, marginTop: 4 }}>
          <Words text={adCopy.cta.url} at={8} gold={[0]} />
        </div>
        <div style={{ marginTop: 28 * u }}>
          <PricePill p={ease(f, 12, 20)}>{fill(adCopy.cta.price, STARTING_PRICE)}</PricePill>
        </div>
        <div
          style={{
            marginTop: 36 * u,
            fontFamily: FONT.title,
            fontSize: 56 * u,
            color: A.cream,
            background: `linear-gradient(180deg, ${A.coral}, ${A.coralDeep})`,
            border: `3px solid ${A.gold}`,
            borderRadius: 999,
            padding: `${22 * u}px ${64 * u}px`,
            boxShadow: `0 0 0 ${10 + 8 * (pulse - 1) * 25}px rgba(216,178,106,${0.2 - (pulse - 1) * 2}), 0 30px 60px -20px rgba(0,0,0,.8)`,
            opacity: btn,
            transform: `scale(${(0.8 + btn * 0.2) * pulse})`,
          }}
        >
          {adCopy.cta.button}
        </div>
      </div>
      <Vignette strength={0.45} />
    </Leather>
  );
};

/** A flash of warm light at every cut (used by the timeline). */
export { LightLeak };
