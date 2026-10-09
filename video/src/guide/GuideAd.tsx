// ---------------------------------------------------------------------------
// The guided journey ad: a camera journey through the real site, with the
// star guide, coral comic overlays, full screen hats and sound design.
//
//   ad-guide-a, ad-guide-b, ad-guide-c   30 s, three hooks (A/B testing)
//   ad-guide-15                          15 s cutdown with hook A
//
// Words: src/guide-copy.ts. Sounds and their timing: src/guide-sfx.ts.
// Timing of the pictures: src/guide/timeline.ts.
// ---------------------------------------------------------------------------

import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { checkHats } from "../ad/prices";
import { loadFonts } from "../fonts";
import { Arrival, Bookings, Build, Cart, EndCard, GUIDE_HATS, GuidedScroll, HookA, HookB, HookC, IntoBuilder, QuickScroll } from "./sections";
import { GuideSound } from "./sound";
import { C } from "./theme";
import { type Cut, PLANS, type SectionId, layout } from "./timeline";

loadFonts();
// a hat the builder would refuse (an engraved straw hat, a wrong id) stops the render
checkHats(GUIDE_HATS);

export type GuideProps = { cut: Cut; hasMusic: boolean; logo: string };

/** The high resolution logo icon if it is there, else the site's logo. */
export const LOGO_ICON = "brand/logo-icon.png";
export const LOGO_FALLBACK = "logo.png";

function section(id: SectionId, clock: number, logo: string) {
  switch (id) {
    case "hookA":
      return <HookA clock={clock} />;
    case "hookB":
      return <HookB clock={clock} />;
    case "hookC":
      return <HookC clock={clock} logo={logo} />;
    case "arrival":
      return <Arrival clock={clock} />;
    case "scroll":
      return <GuidedScroll clock={clock} />;
    case "intoBuilder":
      return <IntoBuilder clock={clock} />;
    case "build":
      return <Build plan={PLANS.build} clock={clock} />;
    case "buildShort":
      return <Build plan={PLANS.buildShort} clock={clock} />;
    case "cart":
      return <Cart clock={clock} />;
    case "bookings":
      return <Bookings clock={clock} />;
    case "end":
      return <EndCard clock={clock} logo={logo} />;
    case "quickScroll":
      return <QuickScroll clock={clock} />;
  }
}

export const GuideAd: React.FC<GuideProps> = ({ cut, hasMusic, logo }) => (
  <AbsoluteFill style={{ background: C.cream }}>
    {layout(cut).map((s) => (
      <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
        {section(s.id, s.from, logo)}
      </Sequence>
    ))}
    {/* paper grain over everything, very light */}
    <AbsoluteFill style={{ backgroundImage: `url(${staticFile("textures/grain.png")})`, opacity: 0.05, mixBlendMode: "multiply", pointerEvents: "none" }} />
    <GuideSound cut={cut} hasMusic={hasMusic} />
  </AbsoluteFill>
);
