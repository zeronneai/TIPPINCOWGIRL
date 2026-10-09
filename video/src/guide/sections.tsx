// ---------------------------------------------------------------------------
// The sections of the guided journey ad. Each one is timed by its plan in
// timeline.ts (the same named moments the sounds hang on) and films the
// real site through the Camera, with the star guide showing the way.
//
// Captions come from guide-copy.ts; prices from src/shop/pricing.js.
// ---------------------------------------------------------------------------

import React from "react";
import { AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { guideCopy } from "../guide-copy";
import { type HatConfig, STRAW, SUEDE, WOOL } from "../ad-hats";
import { Hat } from "../ad/Hat";
import { STARTING_PRICE, TYPE_PRICES, dollars } from "../ad/prices";
import { Camera, type CamKeys, type Mark, VH, box, camAt, drawerBox, navBox, project, projectRect } from "./camera";
import { DustPuff, Halftone, Lasso, MotionLines, Sparkles, type Rect } from "./comic";
import { HAT_CENTER, HeroHat, HatGround } from "./HeroHat";
import { Star, type StarPlan, mid } from "./Star";
import { C, FONT } from "./theme";
import { Chip, Sticker, WoodSign } from "./type";
import { clamp01, eased, lerp, prog } from "./motion";
import { type BuildPlan, PLANS } from "./timeline";

// ---- the hats ----------------------------------------------------------------------------------------------
/** Hook A: a plain wool hat, then four pieces slam on. */
const HOOK_STEPS: HatConfig[] = [
  { hatType: "wool", baseId: "sand" },
  { hatType: "wool", baseId: "sand", featherId: "turquoise" },
  { hatType: "wool", baseId: "sand", featherId: "turquoise", cordId: "concho-silver" },
  { hatType: "wool", baseId: "sand", featherId: "turquoise", cordId: "concho-silver", budSize: "large", budColor: "teal" },
  { hatType: "wool", baseId: "sand", featherId: "turquoise", cordId: "concho-silver", budSize: "large", budColor: "teal", matchesColor: "red" },
];
/** The wool hat that gets engraved (initials on the front). Straw is never engraved. */
const WOOL_ENGRAVED: HatConfig = { ...WOOL, cordId: "concho-silver", engraving: [{ kind: "text", text: "JO", font: "durango", size: "large", position: "front" }] };
export const GUIDE_HATS: HatConfig[] = [...HOOK_STEPS, STRAW, SUEDE, WOOL_ENGRAVED];

const typeTag = (id: string) => {
  const t = TYPE_PRICES.find((x) => x.id === id);
  return t ? guideCopy.build.typeTag.replace("{type}", t.name).replace("{price}", dollars(t.from)) : "";
};

// ---- shared pieces -------------------------------------------------------------------------------------
/** The ground behind the phone: cream, coral halftone drifting slower than the page (parallax). */
const Ground: React.FC<{ shift?: number }> = ({ shift = 0 }) => (
  <AbsoluteFill style={{ background: C.cream }}>
    <AbsoluteFill style={{ background: "radial-gradient(70% 45% at 50% 62%, rgba(255,250,240,1), rgba(250,241,226,0) 70%)" }} />
    <Halftone shift={shift} />
  </AbsoluteFill>
);

/** Content that whips off the frame (with real motion blur) between `from` and `to`. */
const WhipOut: React.FC<{ from: number; to: number; dx?: number; dy?: number; children: React.ReactNode }> = ({ from, to, dx = 0, dy = -1900, children }) => {
  const f = useCurrentFrame();
  const inner = <WhipInner from={from} to={to} dx={dx} dy={dy}>{children}</WhipInner>;
  return f >= from && f <= to ? (
    <CameraMotionBlur shutterAngle={200} samples={8}>
      {inner}
    </CameraMotionBlur>
  ) : (
    inner
  );
};
const WhipInner: React.FC<{ from: number; to: number; dx: number; dy: number; children: React.ReactNode }> = ({ from, to, dx, dy, children }) => {
  const f = useCurrentFrame();
  const t = eased(prog(f, from, to), "in");
  return <AbsoluteFill style={{ transform: `translate(${dx * t}px, ${dy * t}px)` }}>{children}</AbsoluteFill>;
};

const rectOf = (r: { x: number; y: number; w: number; h: number }): Rect => r;

/** A lasso around something on the page, following the camera. */
const PageLasso: React.FC<{ keys: CamKeys; r: number[]; at: number; out?: number; seed: string; on?: "page" | "screen" }> = ({ keys, r, at, out, seed, on = "page" }) => {
  const f = useCurrentFrame();
  return <Lasso rect={rectOf(projectRect(camAt(f, keys), r, on))} at={at} out={out} seed={seed} />;
};

/** Ring the option just tapped, and shade the button for a moment. */
const ring = (rect: number[], from: number, to: number): Mark => ({ rect, from, to, kind: "ring" });
const press = (rect: number[], at: number): Mark => ({ rect, from: at, to: at + 7, kind: "press" });

/** Where the preview's hat is on the frame at a frame of a camera (for match cuts). */
function stageRect(keys: CamKeys, f: number): Rect {
  const cam = camAt(f, keys);
  const sb = box("builder-base", "stage");
  // the preview sits pinned under the nav: its square, in screen px
  const r = projectRect(cam, [sb[0], 64, sb[2], sb[2]], "screen");
  return { x: r.x, y: r.y, w: r.w, h: r.h };
}

// ---- hooks -----------------------------------------------------------------------------------------------
export const HookA: React.FC<{ clock: number }> = ({ clock }) => {
  const P = PLANS.hookA;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // which pieces are on: each slams on at its frame
  let k = 0;
  P.pieces.forEach((t, i) => {
    if (f >= t) k = i + 1;
  });
  const config = HOOK_STEPS[k];
  const prev = k ? HOOK_STEPS[k - 1] : undefined;
  const changeAt = k ? P.pieces[k - 1] : undefined;
  // the plain hat slams down at the start
  const slam = spring({ frame: f - P.hat, fps, config: { damping: 12, stiffness: 240, mass: 0.6 } });
  return (
    <AbsoluteFill>
      <WhipOut from={P.out.from} to={P.out.to}>
        <AbsoluteFill style={{ transform: `scale(${1.25 - 0.25 * slam})`, transformOrigin: `${HAT_CENTER.x}px ${HAT_CENTER.y}px` }}>
          <HeroHat config={config} prev={prev} changeAt={changeAt} sweepAt={P.sweep} sparkleAt={P.sparkle} impacts={[P.hat + 4, ...P.pieces.map((t) => t + 6)]} clock={clock} />
        </AbsoluteFill>
        <Sticker lines={guideCopy.hooks.a.lines} at={P.caption} />
      </WhipOut>
    </AbsoluteFill>
  );
};

/** Hook B: a fast push into the builder's live preview on the phone. */
export const HookB: React.FC<{ clock: number }> = ({ clock }) => {
  const P = PLANS.hookB;
  const f = useCurrentFrame();
  const keys: CamKeys = {
    clock,
    surface: [[0, "builder-size"]],
    scroll: [{ f: 0, v: 201 }],
    y: [{ f: 0, v: 160 }, { f: P.push.to, v: 0 }],
    tiltX: [{ f: 0, v: 9 }, { f: P.push.to, v: 0 }],
    zoom: [{ f: P.push.from, v: 1 }, { f: P.push.to, v: 1.95, ease: "whip" }],
    fx: [{ f: 0, v: 195 }],
    fy: [{ f: 0, v: 236 }],
    float: [{ f: 0, v: 0.5 }, { f: P.push.to, v: 0.15 }],
    stage: [[0, "stage-engraved"]],
  };
  const hat = stageRect(keys, f);
  return (
    <AbsoluteFill>
      <WhipOut from={P.out.from} to={P.out.to}>
        <Ground shift={-f * 0.8} />
        <Camera keys={keys} />
        <Sparkles x={hat.x + hat.w / 2} y={hat.y + hat.w * 0.45} at={P.sparkle} count={7} radius={hat.w * 0.45} seed="hookb" />
        <MotionLines x={540} y={1150} angle={-90} at={P.push.from + 2} dur={14} count={6} spread={700} length={220} seed="hookb" />
        <Sticker lines={guideCopy.hooks.b.lines} at={P.caption} />
      </WhipOut>
    </AbsoluteFill>
  );
};

/** The logo, as it is: never stretched, never recolored. */
export const Logo: React.FC<{ src: string; size: number; style?: React.CSSProperties }> = ({ src, size, style }) => (
  <Img src={staticFile(src)} style={{ width: size, height: size, objectFit: "contain", display: "block", filter: "drop-shadow(0 18px 26px rgba(43,33,24,.3))", ...style }} />
);

/** Hook C: a logo sting, then the hero. */
export const HookC: React.FC<{ clock: number; logo: string }> = ({ clock, logo }) => {
  const P = PLANS.hookC;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f - P.logo, fps, config: { damping: 10, stiffness: 180, mass: 0.7 } });
  const leave = eased(prog(f, P.phoneIn.from - 2, P.phoneIn.from + 8), "whip", 0);
  const keys: CamKeys = {
    clock,
    surface: [[0, "home"]],
    y: [{ f: P.phoneIn.from, v: 1500 }, { f: P.phoneIn.to, v: 0, ease: "whip" }],
    tiltX: [{ f: P.phoneIn.from, v: 16 }, { f: P.phoneIn.to + 6, v: 0 }],
  };
  return (
    <AbsoluteFill>
      <WhipOut from={P.out.from} to={P.out.to}>
        <Ground shift={-f * 0.8} />
        {f >= P.phoneIn.from && <Camera keys={keys} />}
        {leave < 1 && (
          <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", transform: `translateY(${-leave * 1300}px)` }}>
            <AbsoluteFill style={{ background: `repeating-conic-gradient(from ${f * 0.6}deg at 50% 50%, rgba(232,103,74,.18) 0deg 6deg, rgba(232,103,74,0) 6deg 15deg)`, opacity: clamp01(pop), WebkitMaskImage: "radial-gradient(40% 25% at 50% 50%, #000 0%, transparent 100%)" }} />
            <div style={{ transform: `scale(${0.4 + 0.6 * pop})`, opacity: clamp01(pop * 3) }}>
              <Logo src={logo} size={460} />
            </div>
          </AbsoluteFill>
        )}
        <Sparkles x={540} y={960} at={P.shimmer} count={9} radius={330} size={34} seed="logo" />
        <Sticker lines={guideCopy.hooks.c.lines} at={P.caption} />
      </WhipOut>
    </AbsoluteFill>
  );
};

// ---- arrival, the guided scroll, into the builder ---------------------------------------------------------------
const KICKER = box("home", "kicker");
const TITLE = box("home", "title");
const BUILD_BTN = box("home", "build");
/** Captions sit low while the camera pushes into the hero (its own big heading is up top). */
const LOW = 1330;
const BOOK_BTN = box("home", "book");
/** Where the arrival's push-in looks: the hero's line and title. */
const HERO_FOCUS = { x: 195, y: (KICKER[1] + TITLE[1] + TITLE[3]) / 2 };
const ARRIVAL_ZOOM = 1.45;
/** Where the glide ends: in the builder, among the feathers and cords. */
const GLIDE_END = box("home", "builder")[1] + 1500;
/** Where the star rides during the glide (screen px). */
const STAR_RIDE: [number, number] = [346, 520];
/** The builder, as the whip lands on it: the live preview pinned under the nav. */
const BUILDER_SCROLL = box("home", "builder")[1] + 200;

export const Arrival: React.FC<{ clock: number }> = ({ clock }) => {
  const P = PLANS.arrival;
  const f = useCurrentFrame();
  const keys: CamKeys = {
    clock,
    surface: [[0, "home"]],
    // already rising into the frame on its first frame: the hook whips up, the phone follows
    y: [{ f: P.phoneIn.from, v: 820 }, { f: P.phoneIn.to, v: 0, ease: "glide" }],
    tiltX: [{ f: P.phoneIn.from, v: 16 }, { f: P.phoneIn.to + 8, v: 0 }],
    tiltY: [{ f: P.phoneIn.from, v: -8 }, { f: P.phoneIn.to + 8, v: 0 }],
    zoom: [{ f: P.push.from, v: 1 }, { f: P.push.to, v: ARRIVAL_ZOOM }],
    fx: [{ f: 0, v: HERO_FOCUS.x }],
    fy: [{ f: 0, v: HERO_FOCUS.y }],
    float: [{ f: 0, v: 1 }, { f: P.push.from, v: 1 }, { f: P.push.to, v: 0.25 }],
  };
  const star: StarPlan = { from: [1180, 140], stops: [{ at: { page: [KICKER[0] + 52, KICKER[1] + 8] }, f: P.starLand, fly: P.starIn.to - P.starIn.from }] };
  const landAt = camAt(P.starLand, keys);
  const kp = project(landAt, KICKER[0] + 52, KICKER[1] + 8);
  return (
    <AbsoluteFill>
      <Ground shift={-f * 0.8} />
      <Camera keys={keys} />
      <Sparkles x={kp.x} y={kp.y} at={P.starLand} count={6} radius={90} size={22} seed="arrive" />
      <Star plan={star} keys={keys} />
      <Sticker lines={guideCopy.arrival.lines} at={P.caption} out={P.dur - 6} />
    </AbsoluteFill>
  );
};

export const GuidedScroll: React.FC<{ clock: number }> = ({ clock }) => {
  const P = PLANS.scroll;
  const f = useCurrentFrame();
  const keys: CamKeys = {
    clock,
    surface: [[0, "home"]],
    zoom: [{ f: P.pull.from, v: ARRIVAL_ZOOM }, { f: P.pull.to, v: 1 }],
    fx: [{ f: 0, v: HERO_FOCUS.x }],
    fy: [{ f: P.pull.from, v: HERO_FOCUS.y }, { f: P.pull.to, v: VH / 2 }],
    scroll: [{ f: P.glide.from, v: 0 }, { f: P.glide.to, v: GLIDE_END }],
    // the phone frame drops away: the page fills the screen for the glide
    bleed: [{ f: P.pull.from, v: 0 }, { f: P.pull.to, v: 1 }, { f: P.frameBack.from, v: 1 }, { f: P.frameBack.to, v: 0 }],
    float: [{ f: 0, v: 0.25 }, { f: P.pull.to, v: 0 }, { f: P.frameBack.from, v: 0 }, { f: P.frameBack.to, v: 1 }],
  };
  const star: StarPlan = {
    stops: [
      { at: { page: [KICKER[0] + 52, KICKER[1] + 8] }, f: 0, fly: 1 },
      { at: { screen: STAR_RIDE }, f: P.glide.from + 2, fly: 14 },
    ],
  };
  const cam = camAt(f, keys);
  const sp = project(cam, ...STAR_RIDE);
  return (
    <AbsoluteFill>
      <Ground shift={-f * 0.8 - cam.scroll * 0.05} />
      <Camera keys={keys} />
      {/* speed lines behind the star while the page flies under it */}
      {[0, 1, 2, 3].map((i) => (
        <MotionLines key={i} x={sp.x} y={sp.y} angle={90} at={P.glide.from + 14 + i * 16} dur={16} count={4} spread={70} length={120} seed={`glide${i}`} />
      ))}
      <Star plan={star} keys={keys} />
      <Sticker lines={guideCopy.scroll.lines} at={P.caption} out={P.dur - 6} top={LOW} />
    </AbsoluteFill>
  );
};

export const IntoBuilder: React.FC<{ clock: number }> = ({ clock }) => {
  const P = PLANS.intoBuilder;
  const f = useCurrentFrame();
  const btnFocus = mid(BUILD_BTN);
  const keys: CamKeys = {
    clock,
    surface: [[0, "home"]],
    scroll: [
      { f: P.whip.from, v: GLIDE_END },
      { f: P.whip.to, v: 0, ease: "whip" },
      { f: P.whipIn.from, v: 0 },
      { f: P.whipIn.to, v: BUILDER_SCROLL, ease: "whip" },
    ],
    zoom: [
      { f: P.push.from, v: 1 },
      { f: P.push.to, v: 1.7 },
      { f: P.whipIn.from, v: 1.7 },
      { f: P.whipIn.to, v: 1, ease: "whip" },
    ],
    fx: [{ f: 0, v: btnFocus[0] }],
    fy: [{ f: P.push.from, v: VH / 2 }, { f: P.push.to, v: btnFocus[1] }, { f: P.whipIn.from, v: btnFocus[1] }, { f: P.whipIn.to, v: VH / 2, ease: "whip" }],
    tiltX: [{ f: P.whip.from, v: 0 }, { f: P.whip.from + 6, v: -7 }, { f: P.whip.to + 6, v: 0 }],
    float: [{ f: 0, v: 1 }, { f: P.push.from, v: 0.2 }, { f: P.whipIn.to, v: 1 }],
    marks: [press(BUILD_BTN, P.tap)],
  };
  const star: StarPlan = {
    stops: [
      { at: { screen: STAR_RIDE }, f: 0, fly: 1 },
      { at: { page: [BUILD_BTN[0] + BUILD_BTN[2] - 14, BUILD_BTN[1] + 10] }, f: P.starLand, fly: 10 },
      // after the tap, onto the live preview the whip lands on
      { at: { screen: [318, 110] }, f: P.whipIn.to + 4, fly: 14 },
    ],
    taps: [P.tap],
    pulse: [[P.starLand + 4, P.tap - 2]],
  };
  return (
    <AbsoluteFill>
      <Ground shift={-f * 0.8} />
      <Camera keys={keys} />
      <PageLasso keys={keys} r={BUILD_BTN} at={P.lasso} out={P.whipIn.from - 2} seed="build-btn" />
      <Star plan={star} keys={keys} />
      <Sticker lines={guideCopy.intoBuilder.lines} at={P.caption} out={P.whipIn.from + 4} top={LOW} />
    </AbsoluteFill>
  );
};

// ---- the build -----------------------------------------------------------------------------------------------
const BB = (n: string) => box("builder-base", n);
const BS = (n: string) => box("builder-style", n);
const BE = (n: string) => box("builder-engrave", n);
/** A scroll that puts a box's top `y` CSS px down the screen (under the pinned preview). */
const at = (b: number[], y = 500) => b[1] - y;

export const Build: React.FC<{ plan: BuildPlan; clock: number }> = ({ plan: P, clock }) => {
  const f = useCurrentFrame();
  const [straw, suede, wool] = [BB("straw"), BB("suede"), BB("wool")];
  const sand = BB("sand");
  const [t1, t2, t3] = P.typeTaps;

  // a) Pick your base: hat type, then color
  const baseScroll = BUILDER_SCROLL - box("home", "builder")[1];
  const keysA: CamKeys = {
    clock,
    surface: [[0, "builder-base"]],
    scroll: [{ f: P.toColor.from, v: baseScroll }, { f: P.toColor.to, v: at(sand, 494) }],
    zoom: [{ f: 0, v: 1 }, { f: 8, v: 1.08 }],
    fy: [{ f: 0, v: VH / 2 }, { f: 8, v: 470 }],
    stage: [
      [0, "stage-default"],
      [t1 + 2, "stage-straw"],
      [t2 + 2, "stage-suede"],
      [t3 + 2, "stage-wool-black"],
      [P.colorTap + 2, "stage-wool"],
    ],
    marks: [ring(straw, t1 + 2, t2 + 2), ring(suede, t2 + 2, t3 + 2), ring(wool, t3 + 2, P.straw), ring(sand, P.colorTap + 2, P.straw), press(straw, t1), press(suede, t2), press(wool, t3), press(sand, P.colorTap)],
  };
  const starA: StarPlan = {
    stops: [
      { at: { screen: [318, 110] }, f: 0, fly: 1 },
      { at: { page: mid(straw, 20, -30) }, f: t1 - 2, fly: 8 },
      { at: { page: mid(suede, 20, -30) }, f: t2 - 2, fly: 7 },
      { at: { page: mid(wool, 20, -30) }, f: t3 - 2, fly: 7 },
      { at: { page: mid(sand, 20, -30) }, f: P.colorTap - 2, fly: 8 },
    ],
    taps: [t1, t2, t3, P.colorTap],
  };

  // c) Stack your style: feather, cord, brim bud, each on the live preview
  const [s1, s2, s3] = P.stackTaps;
  const [m1, m2] = P.stackMoves;
  const [tq, concho, bud] = [BS("turquoise"), BS("concho"), BS("budLarge")];
  const keysC: CamKeys = {
    clock,
    surface: [[0, "builder-style"]],
    y: [{ f: P.stack, v: 760 }, { f: P.stack + 9, v: 0 }],
    scroll: [{ f: m1.from, v: at(tq) }, { f: m1.to, v: at(concho) }, { f: m2.from, v: at(concho) }, { f: m2.to, v: at(bud) }],
    zoom: [{ f: 0, v: 1.08 }],
    fy: [{ f: 0, v: 470 }],
    stage: [
      [0, "stage-wool"],
      [s1 + 2, "stage-feather"],
      [s2 + 2, "stage-cord"],
      [s3 + 2, "stage-bud"],
    ],
    marks: [ring(tq, s1 + 2, P.suede), ring(concho, s2 + 2, P.suede), ring(bud, s3 + 2, P.suede), press(tq, s1), press(concho, s2), press(bud, s3)],
  };
  const starC: StarPlan = {
    from: [1180, 900],
    stops: [
      { at: { page: mid(tq, 20, -30) }, f: s1 - 2, fly: 8 },
      { at: { page: mid(concho, 20, -30) }, f: s2 - 2, fly: 10 },
      { at: { page: mid(bud, 20, -30) }, f: s3 - 2, fly: 10 },
    ],
    taps: [s1, s2, s3],
  };

  // e) Make it unmistakably yours: initials, then add the brand
  const [field, add] = [BE("engraveText"), BE("addText")];
  const keysE: CamKeys = {
    clock,
    surface: [[0, "builder-engrave"]],
    y: [{ f: P.yours, v: 760 }, { f: P.yours + 9, v: 0 }],
    scroll: [{ f: P.toAdd.from, v: at(field, 470) }, { f: P.toAdd.to, v: at(add, 560) }],
    zoom: [{ f: P.addTap + 3, v: 1.08 }, { f: P.wool, v: 1.5 }],
    fx: [{ f: 0, v: 195 }],
    fy: [{ f: P.addTap + 3, v: 470 }, { f: P.wool, v: 250 }],
    stage: [
      [0, "stage-bud"],
      [P.addTap + 2, "stage-engraved"],
    ],
    marks: [press(add, P.addTap)],
  };
  const starE: StarPlan = {
    from: [1180, 900],
    stops: [
      { at: { page: [field[0] + 70, field[1] + field[3] / 2] }, f: P.yours + 10, fly: 9 },
      { at: { page: mid(add, 120, 0) }, f: P.addTap - 2, fly: 9 },
    ],
    taps: [P.addTap],
    exit: P.addTap + 6,
    exitTo: [1200, 300],
  };

  // the match cuts: each full screen hat grows out of the preview on the phone
  const fromA = stageRect(keysA, P.straw - 1);
  const fromC = stageRect(keysC, P.suede - 1);
  const fromE = stageRect(keysE, P.wool - 1);
  const show = (a: number, b: number) => f >= a && f < b;

  return (
    <AbsoluteFill>
      {show(0, P.straw) && (
        <>
          <Ground shift={-f * 0.8} />
          <Camera keys={keysA} />
          <Star plan={starA} keys={keysA} />
        </>
      )}
      <Sequence from={P.straw} durationInFrames={P.stack - P.straw} layout="none">
        <FullHat config={STRAW} fromRect={fromA} tag={typeTag("straw")} clock={clock + P.straw} out={P.stack - P.straw} />
      </Sequence>
      {show(P.stack, P.suede) && (
        <>
          <Ground shift={-f * 0.8} />
          <Camera keys={keysC} />
          <Star plan={starC} keys={keysC} />
        </>
      )}
      <Sequence from={P.suede} durationInFrames={P.yours - P.suede} layout="none">
        <FullHat config={SUEDE} fromRect={fromC} tag={typeTag("suede")} clock={clock + P.suede} out={P.yours - P.suede} />
      </Sequence>
      {show(P.yours, P.wool) && (
        <>
          <Ground shift={-f * 0.8} />
          <Camera keys={keysE} />
          <Star plan={starE} keys={keysE} />
        </>
      )}
      <Sequence from={P.wool} durationInFrames={P.dur - P.wool} layout="none">
        <WhipOut from={P.dur - P.wool - 6} to={P.dur - P.wool}>
          <HeroHat config={WOOL_ENGRAVED} fromRect={fromE} engraveAt={P.burn - P.wool} sweepAt={P.woolSweep - P.wool} sparkleAt={P.woolSparkle - P.wool} clock={clock + P.wool} />
          <TagChip text={typeTag("wool")} at={10} />
        </WhipOut>
      </Sequence>

      {/* the captions run across the cuts */}
      <Sticker lines={guideCopy.build.base.lines} at={P.baseCaption} out={P.stack - 6} />
      <Sticker lines={guideCopy.build.stack.lines} at={P.stackCaption} out={P.yours - 6} />
      <Sticker lines={guideCopy.build.yours.lines} at={P.yoursCaption} out={P.dur - 5} />
    </AbsoluteFill>
  );
};

/** The type and its price (from pricing.js) under a full screen hat. */
const TagChip: React.FC<{ text: string; at: number }> = ({ text, at }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 1452, display: "flex", justifyContent: "center" }}>
    <Chip at={at} size={34}>
      {text}
    </Chip>
  </div>
);

/** A hat assembling full screen, grown out of the phone's preview. */
const FullHat: React.FC<{ config: HatConfig; fromRect: Rect; tag: string; clock: number; out: number }> = ({ config, fromRect, tag, clock, out }) => {
  // the base grows out of the preview, then the pieces drop every 6 frames
  const gap = 6;
  const n = 1 + [config.featherId, config.cordId, config.budSize].filter((x) => x && x !== "none").length;
  const impacts = Array.from({ length: n - 1 }, (_, i) => 1 + (i + 1) * gap + 6);
  return (
    <WhipOut from={out - 6} to={out}>
      <HeroHat config={config} fromRect={fromRect} assemble={{ start: 1, gap }} impacts={impacts} sweepAt={out - 18} clock={clock} />
      <TagChip text={tag} at={8} />
    </WhipOut>
  );
};

// ---- the cart ------------------------------------------------------------------------------------------------
export const Cart: React.FC<{ clock: number }> = ({ clock }) => {
  const P = PLANS.cart;
  const f = useCurrentFrame();
  const size = box("builder-size", "sizeChoice");
  const add = box("builder-size", "add");
  const line = drawerBox("drawer-cart", "line");
  const keys: CamKeys = {
    clock,
    surface: [[0, "builder-size"]],
    y: [{ f: 0, v: 760 }, { f: 10, v: 0 }],
    scroll: [{ f: 0, v: 99999 }], // as far down as the builder goes: size and the add button
    zoom: [{ f: P.push.from, v: 1 }, { f: P.push.to, v: 1.75 }, { f: P.out.from, v: 1.75 }, { f: P.out.to, v: 1.2, ease: "whip" }],
    fx: [{ f: 0, v: 195 }],
    fy: [{ f: P.push.from, v: VH / 2 }, { f: P.push.to, v: line[1] + line[3] / 2 + 12 }],
    x: [{ f: P.out.from, v: 0 }, { f: P.out.to, v: -1300, ease: "in" }],
    tiltY: [{ f: P.out.from, v: 0 }, { f: P.out.to, v: 16 }],
    stage: [[0, "stage-engraved"]],
    nav: [
      [0, "nav"],
      [P.inCart, "nav-cart"],
    ],
    // the drawer, cut under the hat's line: the ad shows the hat, not the cart's small print
    drawer: { name: "drawer-cart", open: P.drawer, clipBottom: 262 },
    marks: [ring(size, P.sizeTap + 2, P.dur), press(size, P.sizeTap), press(add, P.addTap)],
    float: [{ f: 0, v: 1 }, { f: P.push.from, v: 0.2 }],
  };
  const star: StarPlan = {
    from: [1180, 760],
    stops: [
      { at: { page: mid(size, 22, -24) }, f: P.sizeTap - 2, fly: 10 },
      { at: { page: mid(add, 110, 0) }, f: P.addTap - 2, fly: 8 },
    ],
    taps: [P.sizeTap, P.addTap],
    exit: P.addTap + 4,
    exitTo: [1200, 220],
  };
  // the finished hat drops from the preview into the cart in the nav
  const s = stageRect(keys, P.fly.from);
  const cartBox = navBox("cart");
  const t = eased(prog(f, P.fly.from, P.fly.to), "glide", 0);
  const camNow = camAt(f, keys);
  const to = project(camNow, cartBox[0] + cartBox[2] / 2, cartBox[1] + cartBox[3] / 2);
  const fromP = { x: s.x + s.w / 2, y: s.y + s.w / 2 };
  const hx = lerp(fromP.x, to.x, t);
  const hy = lerp(fromP.y, to.y, t) - Math.sin(Math.PI * t) * 260;
  const hs = lerp(s.w, 70, t);
  const cartP = project(camAt(P.inCart, keys), cartBox[0] + cartBox[2] / 2, cartBox[1] + cartBox[3] / 2);
  return (
    <AbsoluteFill>
      <Ground shift={-f * 0.8} />
      <Camera keys={keys} />
      {f >= P.fly.from && f < P.fly.to && (
        <div style={{ position: "absolute", left: hx - hs / 2, top: hy - hs / 2, width: hs, height: hs, filter: "drop-shadow(0 20px 18px rgba(43,33,24,.3))" }}>
          <Hat config={WOOL_ENGRAVED} size={hs} shadow={false} />
        </div>
      )}
      {f >= P.fly.from && f < P.fly.to && <MotionLines x={hx} y={hy} angle={Math.atan2(to.y - fromP.y, to.x - fromP.x) * (180 / Math.PI)} at={P.fly.from + 2} dur={12} count={4} spread={80} length={110} seed="fly" />}
      <DustPuff x={cartP.x} y={cartP.y + 20} at={P.inCart} size={0.6} seed="cart" />
      <Sparkles x={cartP.x} y={cartP.y} at={P.inCart} count={5} radius={70} size={20} seed="cart" />
      <Star plan={star} keys={keys} />
      <Sticker lines={guideCopy.cart.lines} at={P.caption} out={P.out.from} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 268 + 2 * 112 + 16, display: "flex", justifyContent: "center" }}>
        <Chip at={P.price} out={P.out.from} dark size={34}>
          {guideCopy.cart.price.replace("{price}", dollars(STARTING_PRICE))}
        </Chip>
      </div>
    </AbsoluteFill>
  );
};

// ---- bookings --------------------------------------------------------------------------------------------------
export const Bookings: React.FC<{ clock: number }> = ({ clock }) => {
  const P = PLANS.bookings;
  const f = useCurrentFrame();
  const name = drawerBox("drawer-book", "name");
  const keys: CamKeys = {
    clock,
    surface: [[0, "home"]],
    x: [{ f: P.swing.from, v: 900 }, { f: P.swing.to, v: 0 }],
    tiltY: [{ f: P.swing.from, v: -18 }, { f: P.swing.to + 6, v: 0 }],
    zoom: [{ f: P.push.from, v: 1 }, { f: P.push.to, v: 1.6 }, { f: P.pull.from, v: 1.6 }, { f: P.pull.to, v: 1.12 }],
    fx: [{ f: 0, v: 195 }],
    fy: [{ f: P.push.from, v: VH / 2 }, { f: P.push.to, v: mid(BOOK_BTN)[1] }, { f: P.pull.from, v: mid(BOOK_BTN)[1] }, { f: P.pull.to, v: 330 }],
    drawer: { name: "drawer-book", open: P.drawer },
    marks: [press(BOOK_BTN, P.tap)],
    float: [{ f: 0, v: 1 }, { f: P.push.from, v: 0.2 }, { f: P.pull.to, v: 0.6 }],
  };
  const star: StarPlan = {
    from: [-140, 520],
    stops: [
      { at: { page: [BOOK_BTN[0] + BOOK_BTN[2] - 14, BOOK_BTN[1] + 10] }, f: P.starLand, fly: 14, bow: -1 },
      { at: { screen: [name[0] + name[2] - 30, name[1] - 8] }, f: P.pull.to, fly: 12 },
    ],
    taps: [P.tap],
    pulse: [[P.starLand + 4, P.tap - 2]],
  };
  const sp = project(camAt(P.sparkle, keys), name[0] + name[2] / 2, name[1] + 120);
  return (
    <AbsoluteFill>
      <Ground shift={-f * 0.8} />
      <Camera keys={keys} />
      <PageLasso keys={keys} r={BOOK_BTN} at={P.lasso} out={P.drawer - 2} seed="book-btn" />
      <Sparkles x={sp.x} y={sp.y} at={P.sparkle} count={6} radius={220} size={26} seed="book" />
      <Star plan={star} keys={keys} />
      <Sticker lines={guideCopy.bookings.lines} at={P.caption} out={P.dur - 4} top={LOW} />
    </AbsoluteFill>
  );
};

// ---- the end card --------------------------------------------------------------------------------------------
export const EndCard: React.FC<{ clock: number; logo: string }> = ({ clock, logo }) => {
  const P = PLANS.end;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f - P.logo, fps, config: { damping: 11, stiffness: 170, mass: 0.7 } });
  const signY = 1250;
  const star: StarPlan = {
    from: [1180, 1500],
    stops: [{ at: { video: [540 + 290, signY + 22] }, f: P.starLand, fly: 12 }],
    taps: [P.tap],
    pulse: [[P.starLand + 4, P.tap - 1], [P.tap + 6, P.dur]],
    size: 76,
  };
  return (
    <AbsoluteFill>
      <HatGround spin={(f + clock) * 0.12} shift={-(f + clock) * 0.6} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", justifyContent: "center" }}>
        <div style={{ transform: `scale(${0.5 + 0.5 * pop})`, opacity: clamp01(pop * 3) }}>
          <Logo src={logo} size={420} />
        </div>
      </div>
      <Sparkles x={540} y={540} at={P.logo + 2} count={8} radius={300} size={30} seed="end-logo" />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 820,
          textAlign: "center",
          fontFamily: FONT.body,
          fontWeight: 900,
          fontSize: 46,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.ink,
          opacity: clamp01((f - P.line) / 6),
          transform: `translateY(${(1 - clamp01((f - P.line) / 8)) * 20}px)`,
        }}
      >
        {guideCopy.end.line}
      </div>
      <Sticker lines={[guideCopy.end.url]} at={P.url} top={905} />
      <div style={{ position: "absolute", left: 0, right: 0, top: signY - 75, display: "flex", justifyContent: "center" }}>
        <WoodSign label={guideCopy.end.button} at={P.sign} width={700} height={150} press={P.tap} />
      </div>
      <Sparkles x={540} y={signY} at={P.sparkle} count={7} radius={360} size={28} seed="end-sign" />
      <Star plan={star} keys={null} />
    </AbsoluteFill>
  );
};

// ---- the 15 second cut's fast guided scroll ---------------------------------------------------------------------
export const QuickScroll: React.FC<{ clock: number }> = ({ clock }) => {
  const P = PLANS.quickScroll;
  const f = useCurrentFrame();
  const btnFocus = mid(BUILD_BTN);
  const typeRow = box("home", "builder")[1] + box("builder-base", "type")[1];
  const keys: CamKeys = {
    clock,
    surface: [[0, "home"]],
    y: [{ f: P.phoneIn.from, v: 1500 }, { f: P.phoneIn.to, v: 0, ease: "whip" }],
    tiltX: [{ f: P.phoneIn.from, v: 16 }, { f: P.phoneIn.to + 6, v: 0 }],
    zoom: [{ f: P.phoneIn.to, v: 1 }, { f: P.starLand, v: 1.5 }, { f: P.whipIn.from, v: 1.5 }, { f: P.whipIn.to, v: 1, ease: "whip" }],
    fx: [{ f: 0, v: btnFocus[0] }],
    fy: [{ f: 0, v: btnFocus[1] }, { f: P.whipIn.from, v: btnFocus[1] }, { f: P.whipIn.to, v: VH / 2, ease: "whip" }],
    scroll: [{ f: P.whipIn.from, v: 0 }, { f: P.whipIn.to, v: BUILDER_SCROLL - 300, ease: "whip" }, { f: P.glide.from, v: BUILDER_SCROLL - 300 }, { f: P.glide.to, v: typeRow - 445 }],
    marks: [press(BUILD_BTN, P.tap)],
    float: [{ f: 0, v: 1 }, { f: P.starLand, v: 0.2 }, { f: P.whipIn.to, v: 1 }],
  };
  const star: StarPlan = {
    from: [1180, 160],
    stops: [
      { at: { page: [BUILD_BTN[0] + BUILD_BTN[2] - 14, BUILD_BTN[1] + 10] }, f: P.starLand, fly: 14 },
      { at: { screen: [318, 110] }, f: P.whipIn.to + 4, fly: 12 },
    ],
    taps: [P.tap],
    pulse: [[P.starLand + 4, P.tap - 2]],
  };
  return (
    <AbsoluteFill>
      <Ground shift={-f * 0.8} />
      <Camera keys={keys} />
      <PageLasso keys={keys} r={BUILD_BTN} at={P.lasso} out={P.whipIn.from - 2} seed="build-btn-15" />
      <Star plan={star} keys={keys} />
      <Sticker lines={guideCopy.scroll.lines} at={P.caption} out={P.whipIn.from + 4} top={LOW} />
    </AbsoluteFill>
  );
};
