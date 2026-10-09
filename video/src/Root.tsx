import React from "react";
import { Composition, staticFile } from "remotion";
import { FPS, H, W } from "./theme";
import { TOTAL_FRAMES, TippinPortalDemo, type VideoProps } from "./Video";

/** Is there a music track at public/music.mp3? Asked once, before rendering. */
async function musicIsThere(): Promise<boolean> {
  try {
    const res = await fetch(staticFile("music.mp3"), { method: "HEAD" });
    return res.ok && !(res.headers.get("content-type") || "").includes("text/html");
  } catch {
    return false;
  }
}

export const RemotionRoot: React.FC = () => (
  <Composition
    id="TippinPortalDemo"
    component={TippinPortalDemo}
    width={W}
    height={H}
    fps={FPS}
    durationInFrames={TOTAL_FRAMES}
    defaultProps={{ hasMusic: false } satisfies VideoProps}
    calculateMetadata={async ({ props }) => ({ props: { ...props, hasMusic: await musicIsThere() } })}
  />
);
