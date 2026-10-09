# Tippin' Cowgirl videos

Three things live here, all made with [Remotion](https://www.remotion.dev):

- **The staff portal demo** (`TippinPortalDemo`): a vertical (1080 x 1920,
  30 fps, about 63 seconds) intro to the site and the staff portal, for
  showing the client, from **real screenshots of the app** filled with
  **demo data only** (made up customers whose emails end in `@demo.tippin`).
- **The hat builder ad** (`TippinAd30`, `TippinAd15`, `TippinAd45`): a
  customer facing ad that sells the builder, from the **public site only**.
  See [The hat builder ad](#the-hat-builder-ad) below.
- **The guided journey ad** (`ad-guide-a`, `-b`, `-c`, `ad-guide-15`): a
  camera journey through the real public site with a little coral star as
  the guide, comic overlays and full sound design. See
  [The guided journey ad](#the-guided-journey-ad) below.

This folder is its own project: Remotion, Playwright and React 19 live in
`video/package.json` and `video/node_modules`, never in the site's
dependencies or bundle.

## One time setup

From the repository root:

```
npm install                 # the site's own dependencies (the screenshots build the site)
cd video
npm install                 # Remotion, Playwright
npx playwright install chromium   # the browser that takes the screenshots
```

## Make the portal demo video

```
npm run render
```

writes `video/out/tippin-portal-demo.mp4` (gitignored). The first render
downloads Remotion's own headless Chrome; to use another Chrome, set
`REMOTION_BROWSER_EXECUTABLE` to its path. `npm run render` also downloads
the two brand fonts into `public/fonts` first (see below).

## Preview and tweak

```
npm run studio
```

opens Remotion Studio in the browser: scrub the timeline, play it, and see
edits live.

- **Captions**: every word on screen is in [`src/copy.ts`](src/copy.ts).
  Change or translate them there; keep headlines short (two lines at most).
  Names, amounts and dates come from the demo data captured with the
  screenshots.
- **Timing**: scene lengths and their order are in `SCENES` in
  [`src/Video.tsx`](src/Video.tsx); each scene in `src/scenes/` has its
  own beats (frame numbers at 30 per second).
- **Colors and fonts**: [`src/theme.ts`](src/theme.ts), the site's palette.
- **Safe area**: key text stays between y 250 and y 1570, clear of the
  buttons Instagram Reels and TikTok draw over the top and the bottom.

## Music (optional)

Put a track at **`video/public/music.mp3`**. It plays under the whole video,
fading in and out. Without it the video renders silent; nothing else needs
to change. The file is gitignored, so check its license before sharing the
video.

## Regenerate the screenshots

```
npm run shots
```

`scripts/capture.mjs`:

1. builds the site into `video/.app-build` with a pretend Supabase address
   (no keys; nothing real is contacted),
2. serves it at http://localhost:4180,
3. walks the site and the portal in Playwright at 390 x 844 (2x), answering
   every database call from `scripts/fake-supabase.mjs`: the six demo
   orders from `scripts/seed-demo-orders.js`, the demo bookings from
   `scripts/seed-demo-bookings.js` plus a few more invented ones, with
   "Include demo data" switched on,
4. saves the PNGs in `public/shots/` and, in `src/shots.json`, where each
   highlighted button sits on its screenshot plus the numbers the
   dashboard scene counts up to.

The clock is pinned to Friday, October 9, 2026 (America/Denver), the hero
video is held on its first frame, and animations, focus and hover are
settled before each shot, so running it again makes the same shots (the
one exception: the close button of the cart drawer is a system glyph whose
edges can render a few pixels differently). Set `DEMO_NOW` to move the date. Run it after the
site or the portal changes, then `npm run render`. The fonts and hat
pictures load from their CDNs, so it needs the internet.

## The hat builder ad

Three versions, rendered into `video/out/` (gitignored):

| Command | Composition | Format | Length |
|---|---|---|---|
| `npm run render:ad` | `TippinAd30` | 1080 x 1920 (9:16) | 30 s |
| `npm run render:ad15` | `TippinAd15` | 1080 x 1920 (9:16) | 15 s: hook, build, CTA |
| `npm run render:ad45` | `TippinAd45` | 1080 x 1350 (4:5 feed) | 30 s, re-laid out |

They write `out/tippin-ad-30s.mp4`, `out/tippin-ad-15s.mp4` and
`out/tippin-ad-30s-4x5.mp4`. Each command first runs `fonts` and
`prepare:ad` (below), so on a new computer it just works after
`npm install`.

**The hats are drawn the builder's way.** `src/ad/Hat.tsx` stacks the same
files in the same order as the site: the Cloudinary base, then the
accessory PNGs from `src/shop/layers` in the z-order `catalog.js` gives
(base, feather, cord, bud, matches), and the engraving through the site's
own `EngravingLayer.jsx`. Each piece springs into place, with soft shadows
and a light sweep. `npm run prepare:ad` copies the layers, thumbnails and
engraving fonts and stamps into `public/`, and downloads the base hats
(all generated and gitignored; files already there are kept).

**Edit the captions** in [`src/ad-copy.ts`](src/ad-copy.ts): every line of
every version is there. Write `{price}` where a price goes.

**Prices are never typed.** They come from `src/shop/pricing.js`, the site's
source of truth (`src/ad/prices.ts`): each hat type's "from" price and the
lowest one for "Starting at". Change a price there and the next render
follows.

**Swap the hats** in [`src/ad-hats.ts`](src/ad-hats.ts): the wool, suede
and straw hats, the engraving, the three finished hats of the payoff, and
the "Stack your style" montage (one hat per beat). They are plain builder
configs (ids from `pricing.js`). The ad refuses to render a hat the builder
would refuse, and a straw hat with an engraving (straw cannot be
engraved). Remember that the Prairie Pheasant feather covers the front of
the crown, where a front engraving goes.

**Timing and music.** Every cut lands on a beat of `BPM` (120) in
`src/ad/kit.tsx`; the scene lengths, in beats, are in `src/ad/AdVideo.tsx`
(`FULL` for 30 s, `SHORT` for 15 s). Put a track at
**`video/public/ad-music.mp3`** and it plays under the ad, fading in and
out; at 120 BPM every cut lands on the beat (for another tempo, change
`BPM`). Without the file the ad renders silent. The file is gitignored.

**The screenshots** in the phone are the public site at 390 x 844 (2x):
the hero, the builder steps with real selections (hat type, color,
feather, brim bud, engraving, size), the live preview and the cart.
Regenerate them with

```
npm run shots:ad
```

(`scripts/capture-ad.mjs`, same pinned clock and settling as the demo
shots, so a re-run makes the same files; never opens the staff portal).

**Textures.** `public/textures/leather.jpg` and `grain.png` are rendered
from `src/ad/textures.tsx` by `npm run textures` (small, committed).

**Checking frames.** `npm run stills -- TippinAd30 0,45,180` writes those
frames to `out/stills/` without rendering the whole video.

**Safe area.** On 9:16, key text stays between y 250 and y 1570, clear of
the Reels and TikTok buttons. The 4:5 version has its own layout
(`useLayout` in `src/ad/kit.tsx`).

## The guided journey ad

A camera glides through the real site inside a phone, following a little
coral star (the brand's divider star) that shows the way: the hero, a
guided scroll, the builder step by step, the cart, Book the bar, and an end
card. Between beats the hats assemble full screen from the real layers.
Four compositions, all 1080 x 1920 at 30 fps:

| Command | Composition | Length | Hook (first ~2 s) |
|---|---|---|---|
| `npm run render:guide-a` | `ad-guide-a` | 30 s | A: a plain hat, pieces slam on |
| `npm run render:guide-b` | `ad-guide-b` | 30 s | B: a fast push into the builder |
| `npm run render:guide-c` | `ad-guide-c` | 30 s | C: logo sting, then the hero |
| `npm run render:guide15` | `ad-guide-15` | 15 s | A, then a fast scroll, the build, the end card |

They write `out/tippin-guide-30s-a.mp4`, `-b`, `-c` and
`out/tippin-guide-15s.mp4`. A file over 20 MB also gets a smaller copy in
`out/previews/` for sending. Each command fetches the fonts and hat art,
renders the pictures, renders the sound, brings the sound to **-14 LUFS**
with a look-ahead true peak limiter (no clipping; `scripts/lib/loudness.mjs`)
and prints the result, measured again from the finished file. To redo only
the sound (after changing a cue or a WAV), add `-- --reuse-picture`, for
example `npm run render:guide-a -- --reuse-picture`.

**Edit the words and the hooks** in [`src/guide-copy.ts`](src/guide-copy.ts).
Every line of all four versions is there, the three hooks included. Each
string in `lines` is one line on screen (headlines are stacked stickers,
never rotated); wrap a word in `*stars*` to underline it by hand. Prices are
never typed: `{price}` comes from `src/shop/pricing.js`.

**Swap a sound.** The eight effects are WAV files in `public/sfx/`:
`whoosh-short.wav`, `whoosh-long.wav`, `impact.wav`, `tap.wav`, `pop.wav`,
`shimmer.wav`, `riser.wav`, `logo-hit.wav`. They are synthesized in code by
`npm run sfx` (`scripts/synth-sfx.mjs`: filtered noise sweeps, sine and noise
impacts with envelopes, clicks, a riser; seeded, so the same every time).
To use a professional sound, save it over the file with the same name: it
plays in the same spot. Do not run `npm run sfx` afterwards (it rewrites all
eight); the render scripts only synthesize the ones that are missing.
Whooshes are stretched to the length of the move they go with, so a
replacement whoosh should peak about 40 % in (or change its `peak` in
`WHOOSH`).

**Move a sound or change the mix** in [`src/guide-sfx.ts`](src/guide-sfx.ts):
every cue, each effect's level (`LEVEL`) and the music settings. A cue
hangs on a named moment of a section (`src/guide/timeline.ts`, where the
pictures are timed from the same names), so it stays on its picture when
the timing changes; `offset` nudges it in frames.

**Add music.** Put a track at **`video/public/guide-music.mp3`** and set
`GUIDE_BPM` in `src/guide-sfx.ts` to its tempo: every cut lands on a beat
of it. It fades in and out and dips a little under every impact (`MUSIC`
in the same file). Without it the ad plays with the effects only. The file
is gitignored.

**Timing.** Section lengths are in beats and the moments in frames, in
[`src/guide/timeline.ts`](src/guide/timeline.ts). The camera moves are
keyframes in `src/guide/sections.tsx`, driven by the reusable `Camera`
(`src/guide/camera.tsx`): scroll, push in, pan, full bleed, a little 3D
tilt and float, human easing with a tiny overshoot, and real motion blur
(`@remotion/motion-blur`) on fast moves.

**The hats** assemble from the builder's real layers in its z-order, with
its engraving (`src/ad/Hat.tsx`, shared with the hat builder ad): a wool, a
faux suede and a straw hat. The configs are at the top of
`src/guide/sections.tsx`. A straw hat is never engraved: the render stops
if one is.

**The logo** is `public/brand/logo-icon.png` (the icon only, high
resolution), shown as it is: never stretched or recolored. Until that file
is there, the ad uses the site's `public/logo.png`.

**The screenshots** are the public site at 390 px wide and 3x (sharp at the
closest push-ins), as tall pages cut into tiles: the home page top to
bottom and the builder at each step with real selections, plus what the
site pins on screen (the nav, the builder's live preview at every step), the
cart and the Book the bar drawer filled with obviously fake demo data
("Demo Guest", demo@example.com, a 555 number). Fixed things are hidden in
the tall pages and laid back on top by the camera. Regenerate them with

```
npm run shots:guide
```

(`scripts/capture-guide.mjs`: same pinned clock and fake Supabase as the
other captures, every video held on its first frame; a re-run makes the
same files. It never opens the staff portal and never sends anything.)

**Checking frames.** `npm run stills -- ad-guide-a 0,60,300` writes those
frames to `out/stills/`. Key text stays between y 250 and y 1570 (the
Reels and TikTok safe area).

## Fonts

Alfa Slab One (Google Fonts) and Satoshi (Fontshare), the site's fonts, plus
Playfair Display Italic (Google Fonts) for the ad's serif lines, are
downloaded by `npm run fonts` (also run by `studio` and `render`) into
`public/fonts`. They are not committed: they belong to their publishers.
If the download fails, the video still renders with system fonts.

## Licence note

Remotion is free for individuals and companies of up to three people; larger
companies need a company license. See https://www.remotion.dev/license.
