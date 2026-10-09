# Tippin' Cowgirl demo video

A vertical (1080 x 1920, 30 fps, about 63 seconds) motion graphics intro to
the site and the staff portal, for showing the client. It is made with
[Remotion](https://www.remotion.dev) from **real screenshots of the app**,
filled with **demo data only** (made up customers whose emails end in
`@demo.tippin`).

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

## Make the video

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

The clock is pinned to Friday, October 9, 2026 (America/Denver), so running
it again makes the same shots; set `DEMO_NOW` to move it. Run it after the
site or the portal changes, then `npm run render`. The fonts and hat
pictures load from their CDNs, so it needs the internet.

## Fonts

Alfa Slab One (Google Fonts) and Satoshi (Fontshare), the site's fonts, are
downloaded by `npm run fonts` (also run by `studio` and `render`) into
`public/fonts`. They are not committed: they belong to their publishers.
If the download fails, the video still renders with system fonts.

## Licence note

Remotion is free for individuals and companies of up to three people; larger
companies need a company license. See https://www.remotion.dev/license.
