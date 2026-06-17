# Tippin Cowgirl — interactive landing page

A premium, single-page landing site for **Tippin Cowgirl**, the custom mobile
hat bar in El Paso, TX. The centerpiece is a "Mario-Kart"–style **hat
configurator**: pick the felt, shape the brim, wrap a band, pin a charm and
foil-stamp your initials — with a live SVG preview that recolors and
re-decorates in real time.

Implemented in **React + Vite**, ported from the Claude Design prototype in
`../project/Tippin Cowgirl.dc.html`.

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Structure

- `src/App.jsx` — page shell + all static sections (nav, marquee, hero,
  how-it-works, gallery, events, footer).
- `src/components/Configurator.jsx` — the interactive hat bar (state, step
  tabs, swatches, monogram input, build summary, shuffle).
- `src/hat/HatPreview.jsx` — the live SVG hat (crown, brim, band, charm,
  monogram) that recolors from the current build.
- `src/hat/data.js` — felt / brim / band / charm option data + SVG path and
  color helpers, ported 1:1 from the design.
- `src/styles.css` — reset, keyframes (sway / marquee / glow), hover & focus
  states, and responsive breakpoints.
- `public/logo.png` — the brand mark (cowgirl-on-donkey), cropped from the
  Instagram profile, used in the nav, footer and favicon.

## Notes

- **Copy is in English** to match the brand's Instagram voice.
- The **gallery** uses tasteful placeholder tiles (`[ pop-up event photo ]`,
  etc.) — drop real photos into `public/` and swap the `GalleryTile`
  placeholders in `src/App.jsx` when you have them.
- Three design "tweaks" from the prototype are constants at the top of
  `Configurator.jsx`: `GLOW` (stage accent — terracotta by default),
  `SHOW_MARQUEE`, and `IDLE_SWAY`.
