// ---------------------------------------------------------------------------
// The guide ad's sound: turns the cues in src/guide-sfx.ts into audio at
// the right frames (whooshes stretched to their moves), and plays the
// optional music under it, ducked under every impact.
// ---------------------------------------------------------------------------

import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { CUES, LEVEL, MUSIC, SFX, type SfxName, WHOOSH } from "../guide-sfx";
import { FPS } from "./motion";
import { type Cut, type Move, PLANS, layout, totalFrames } from "./timeline";

export type Hit = { frame: number; sfx: SfxName; volume: number; rate: number; frames: number; duck: boolean };

const isMove = (m: unknown): m is Move => typeof m === "object" && m !== null && "from" in m;

/** Every sound of a version, in frames from the start. */
export function resolveCues(cut: Cut): Hit[] {
  const out: Hit[] = [];
  for (const s of layout(cut)) {
    const plan = PLANS[s.id] as Record<string, unknown>;
    for (const cue of CUES[s.id]) {
      const m = plan[cue.at];
      if (m == null) throw new Error(`guide-sfx.ts: section ${s.id} has no moment "${cue.at}"`);
      const items = Array.isArray(m) ? m : [m];
      for (const it of items as (number | Move)[]) {
        const off = cue.offset ?? 0;
        if (isMove(it)) {
          const len = Math.max(4, it.to - it.from);
          const name: SfxName = cue.sfx === "whoosh" ? (len / FPS <= 0.62 ? "whoosh-short" : "whoosh-long") : cue.sfx;
          const w = WHOOSH[name as keyof typeof WHOOSH];
          if (w) {
            // stretched to the move (within reason), its peak on the move's fastest point
            const rate = Math.max(0.6, Math.min(1.6, (w.length * FPS) / len));
            const start = s.from + it.from + len / 2 - (w.peak / rate) * FPS + off;
            out.push({ frame: Math.round(start), sfx: name, volume: LEVEL[name] * (cue.volume ?? 1), rate, frames: Math.ceil((w.length / rate) * FPS * 1.6) + 4, duck: !!cue.duck });
          } else {
            out.push({ frame: s.from + it.from + off, sfx: name, volume: LEVEL[name] * (cue.volume ?? 1), rate: 1, frames: 4 * FPS, duck: !!cue.duck });
          }
        } else {
          const name: SfxName = cue.sfx === "whoosh" ? "whoosh-short" : cue.sfx;
          out.push({ frame: s.from + it + off, sfx: name, volume: LEVEL[name] * (cue.volume ?? 1), rate: 1, frames: 4 * FPS, duck: !!cue.duck });
        }
      }
    }
  }
  return out.sort((a, b) => a.frame - b.frame);
}

/** The music's level at frame f: faded in and out, ducked under impacts. */
function musicVolume(f: number, hits: Hit[], total: number) {
  let duck = 0;
  for (const h of hits) {
    if (!h.duck) continue;
    const t = f - h.frame;
    if (t < -2 || t > MUSIC.duckFrames) continue;
    // a fast dip, a smooth recovery
    const k = t < 0 ? (t + 2) / 2 : 1 - t / MUSIC.duckFrames;
    duck = Math.max(duck, k * k * (3 - 2 * k));
  }
  const fade = Math.min(1, f / MUSIC.fadeIn, (total - f) / MUSIC.fadeOut);
  return Math.max(0, MUSIC.volume * fade * (1 - MUSIC.duck * duck));
}

export const GuideSound: React.FC<{ cut: Cut; hasMusic: boolean }> = ({ cut, hasMusic }) => {
  const hits = resolveCues(cut);
  const total = totalFrames(cut);
  return (
    <>
      {hits.map((h, i) => {
        // a sound that starts before frame 0 is trimmed, not moved
        const trim = Math.max(0, -h.frame);
        const from = Math.max(0, h.frame);
        const len = Math.min(h.frames - trim, total - from);
        if (len <= 0) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={len} layout="none" name={`sfx ${h.sfx}`}>
            <Audio src={staticFile(SFX[h.sfx])} volume={h.volume} playbackRate={h.rate} startFrom={Math.round(trim * h.rate)} />
          </Sequence>
        );
      })}
      {hasMusic && <Audio src={staticFile(MUSIC.file)} volume={(f) => musicVolume(f, hits, total)} />}
    </>
  );
};
