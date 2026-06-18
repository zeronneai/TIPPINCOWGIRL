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
- `src/hat/Hat3D.jsx` — the live **3D** hat (react-three-fiber). One
  parametric model recolors/reshapes for every felt × brim × band × charm
  combo (525 in all) — no combos authored by hand. Procedural crown + brim,
  felt micro-texture, in-engine studio reflections, drag-to-spin.
  - **Realistic GLB drop-in:** set `HAT_MODEL_URL` (top of the file) to a
    `.glb` whose meshes are named `crown` / `brim` / `band` / `charm`; the
    loader recolors the felt parts automatically and keeps all 525 combos.
  - **Felt textures:** swap the procedural bump in `useFeltBump()` for the
    brand's supplied felt normal/roughness maps when available.
- `src/hat/HatPreview.jsx` — the older 2D SVG hat (kept as a lightweight
  fallback reference).
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
