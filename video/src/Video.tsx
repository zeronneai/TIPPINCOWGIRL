import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { loadFonts } from "./fonts";
import { Bookings } from "./scenes/Bookings";
import { Contact } from "./scenes/Contact";
import { Dashboard } from "./scenes/Dashboard";
import { Intro } from "./scenes/Intro";
import { Manage } from "./scenes/Manage";
import { Next } from "./scenes/Next";
import { Orders } from "./scenes/Orders";
import { Outro } from "./scenes/Outro";
import { Shop } from "./scenes/Shop";
import { Staff } from "./scenes/Staff";
import { C, F, FPS } from "./theme";

loadFonts();

// The scenes in order, with their length in seconds. Neighbors overlap for
// TRANSITION frames, so the video is a little shorter than the sum.
export const SCENES: { id: string; seconds: number; Scene: React.FC; enter: "fade" | "slide" }[] = [
  { id: "intro", seconds: 4, Scene: Intro, enter: "fade" },
  { id: "shop", seconds: 10, Scene: Shop, enter: "fade" },
  { id: "orders", seconds: 8, Scene: Orders, enter: "slide" },
  { id: "dashboard", seconds: 8, Scene: Dashboard, enter: "slide" },
  { id: "manage", seconds: 10, Scene: Manage, enter: "slide" },
  { id: "bookings", seconds: 10, Scene: Bookings, enter: "slide" },
  { id: "contact", seconds: 6, Scene: Contact, enter: "slide" },
  { id: "staff", seconds: 4, Scene: Staff, enter: "slide" },
  { id: "next", seconds: 4, Scene: Next, enter: "fade" },
  { id: "outro", seconds: 3, Scene: Outro, enter: "fade" },
];
export const TRANSITION = 14;
export const TOTAL_FRAMES = SCENES.reduce((n, s) => n + s.seconds * FPS, 0) - TRANSITION * (SCENES.length - 1);

export type VideoProps = { hasMusic: boolean };

export const TippinPortalDemo: React.FC<VideoProps> = ({ hasMusic }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.cream, fontFamily: F.body, color: C.ink }}>
      <TransitionSeries>
        {SCENES.map(({ id, seconds, Scene, enter }, i) => (
          <React.Fragment key={id}>
            {i > 0 && (
              <TransitionSeries.Transition
                presentation={enter === "slide" ? slide({ direction: "from-right" }) : fade()}
                timing={linearTiming({ durationInFrames: TRANSITION })}
              />
            )}
            <TransitionSeries.Sequence durationInFrames={seconds * FPS}>
              <Scene />
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}
      </TransitionSeries>

      {/* ------------------------------------------------------------------
          MUSIC: put a track at video/public/music.mp3 and it plays under the
          whole video, fading in and out. Without the file the video simply
          has no sound (Root.tsx checks for it before rendering).
          ------------------------------------------------------------------ */}
      {hasMusic && (
        <Audio
          src={staticFile("music.mp3")}
          volume={(f) =>
            interpolate(f, [0, FPS, durationInFrames - FPS * 2, durationInFrames - 1], [0, 0.8, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          }
        />
      )}
    </AbsoluteFill>
  );
};
