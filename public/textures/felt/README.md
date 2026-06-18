# Felt PBR textures

Drop tileable felt maps here and the 3D hat picks them up automatically — no
code changes needed. Any subset works; missing maps fall back to the built-in
procedural felt, so the hat always renders.

## Expected files (exact names)

| File                 | Required | Purpose                                                            |
| -------------------- | -------- | ------------------------------------------------------------------ |
| `felt-normal.jpg`    | no\*     | The wool weave. Replaces the procedural bump — biggest realism win.|
| `felt-roughness.jpg` | no       | Micro sheen variation across the felt.                             |
| `felt-albedo.jpg`    | no       | Base color. **Keep it ~neutral / light grey** — it is multiplied by the selected felt color, so a tinted albedo would skew all 7 felts. Omit it entirely to let the solid felt color show through cleanly. |

\* Nothing is strictly required; provide whatever you have.

## Specs

- **Tileable / seamless** (they repeat across the hat).
- Square, power-of-two: **1024×1024** or **2048×2048**.
- `.jpg` (or `.png`). Keep file names exactly as above.
- Normal map: OpenGL convention (Y+). Roughness: linear/grayscale.

## How it's wired

`src/hat/Hat3D.jsx` → `useFeltMaps()` loads `/textures/felt/<file>` at runtime
and feeds them into the shared `FeltMaterial`. Tiling is `FELT_REPEAT` (6×) and
can be tuned at the top of that file. The felt color still comes from the build
state, so all 525 combinations remain pure material params — no baked assets.
