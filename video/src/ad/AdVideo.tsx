import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { checkHats } from "./prices";
import { FINISHED, MONTAGE, STRAW, SUEDE, WOOL } from "../ad-hats";
import { loadFonts } from "../fonts";
import { BEAT, FPS, Grain, LightLeak } from "./kit";
import { Builder, Cta, Desire, Hook, Payoff, Personal, Stack } from "./scenes";

loadFonts();
// a hat the builder would refuse (straw engraved, an unknown id) stops here
checkHats([WOOL, SUEDE, STRAW, ...FINISHED, ...MONTAGE.map((m) => m.hat)]);

// ---------------------------------------------------------------------------
// The cuts, in beats (kit.ts: 120 BPM, a beat is 15 frames). Every scene
// starts on a beat, so a track at that tempo lines up with every cut.
// ---------------------------------------------------------------------------

type Cut = { id: string; beats: number; render: (dur: number) => React.ReactNode };

const FULL: Cut[] = [
  { id: "hook", beats: 4, render: (d) => <Hook dur={d} /> }, // 0 to 2 s
  { id: "desire", beats: 8, render: (d) => <Desire dur={d} /> }, // 2 to 6 s
  { id: "builder", beats: 16, render: (d) => <Builder dur={d} /> }, // 6 to 14 s
  { id: "stack", beats: 14, render: (d) => <Stack dur={d} /> }, // 14 to 21 s
  { id: "personal", beats: 8, render: (d) => <Personal dur={d} /> }, // 21 to 25 s
  { id: "payoff", beats: 6, render: (d) => <Payoff dur={d} /> }, // 25 to 28 s
  { id: "cta", beats: 4, render: (d) => <Cta dur={d} /> }, // 28 to 30 s
];

// 15 seconds: hook, build, CTA
const SHORT: Cut[] = [
  { id: "hook", beats: 4, render: (d) => <Hook dur={d} /> },
  { id: "builder", beats: 6, render: (d) => <Builder dur={d} /> },
  // one beat per caption, ending on "Stack your style."
  { id: "stack", beats: 8, render: (d) => <Stack dur={d} entries={[0, 1, 3, 4, 6, 8, 9, 11]} /> },
  { id: "payoff", beats: 6, render: (d) => <Payoff dur={d} /> },
  { id: "cta", beats: 6, render: (d) => <Cta dur={d} /> },
];

export const AD_CUTS = { full: FULL, short: SHORT };
export const adFrames = (cuts: Cut[]) => cuts.reduce((n, c) => n + c.beats * BEAT, 0);

export type AdProps = { cut: "full" | "short"; hasMusic: boolean };

export const TippinAd: React.FC<AdProps> = ({ cut, hasMusic }) => {
  const { durationInFrames } = useVideoConfig();
  const cuts = AD_CUTS[cut];
  let at = 0;
  const starts = cuts.map((c) => {
    const s = at;
    at += c.beats * BEAT;
    return s;
  });
  return (
    <AbsoluteFill style={{ background: "#140c07" }}>
      {cuts.map((c, i) => (
        <Sequence key={c.id} from={starts[i]} durationInFrames={c.beats * BEAT} name={c.id}>
          {c.render(c.beats * BEAT)}
        </Sequence>
      ))}
      {/* warm light washing over every cut */}
      {starts.slice(1).map((s, i) => (
        <LightLeak key={s} at={s} seed={i + 1} />
      ))}
      <Grain />
      {/* ------------------------------------------------------------------
          MUSIC: put a track at video/public/ad-music.mp3 (120 BPM lines up
          with every cut; change BPM in ad/kit.tsx for another tempo). It
          fades in and out. Without the file the ad renders silent.
          ------------------------------------------------------------------ */}
      {hasMusic && (
        <Audio
          src={staticFile("ad-music.mp3")}
          volume={(f) => interpolate(f, [0, 6, durationInFrames - FPS, durationInFrames - 1], [0, 0.9, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}
    </AbsoluteFill>
  );
};
