import React from "react";
import { Composition, staticFile } from "remotion";
import { AD_CUTS, type AdProps, TippinAd, adFrames } from "./ad/AdVideo";
import { GrainTexture, LeatherTexture } from "./ad/textures";
import { FPS, H, W } from "./theme";
import { TOTAL_FRAMES, TippinPortalDemo, type VideoProps } from "./Video";

/** Is this file in public/? Asked once, before rendering (music is optional). */
async function isThere(file: string): Promise<boolean> {
  try {
    const res = await fetch(staticFile(file), { method: "HEAD" });
    return res.ok && !(res.headers.get("content-type") || "").includes("text/html");
  } catch {
    return false;
  }
}

const withAdMusic = async ({ props }: { props: AdProps }) => ({ props: { ...props, hasMusic: await isThere("ad-music.mp3") } });

export const RemotionRoot: React.FC = () => (
  <>
    {/* the staff portal demo (for the client) */}
    <Composition
      id="TippinPortalDemo"
      component={TippinPortalDemo}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={TOTAL_FRAMES}
      defaultProps={{ hasMusic: false } satisfies VideoProps}
      calculateMetadata={async ({ props }) => ({ props: { ...props, hasMusic: await isThere("music.mp3") } })}
    />

    {/* the hat builder ad (for customers): 30 s, 15 s cutdown, 4:5 feed */}
    <Composition id="TippinAd30" component={TippinAd} width={1080} height={1920} fps={FPS} durationInFrames={adFrames(AD_CUTS.full)} defaultProps={{ cut: "full", hasMusic: false } satisfies AdProps} calculateMetadata={withAdMusic} />
    <Composition id="TippinAd15" component={TippinAd} width={1080} height={1920} fps={FPS} durationInFrames={adFrames(AD_CUTS.short)} defaultProps={{ cut: "short", hasMusic: false } satisfies AdProps} calculateMetadata={withAdMusic} />
    <Composition id="TippinAd45" component={TippinAd} width={1080} height={1350} fps={FPS} durationInFrames={adFrames(AD_CUTS.full)} defaultProps={{ cut: "full", hasMusic: false } satisfies AdProps} calculateMetadata={withAdMusic} />

    {/* the ad's textures, rendered once by `npm run textures` */}
    <Composition id="AdTextureLeather" component={LeatherTexture} width={1080} height={1920} fps={FPS} durationInFrames={1} />
    <Composition id="AdTextureGrain" component={GrainTexture} width={512} height={512} fps={FPS} durationInFrames={1} />
  </>
);
