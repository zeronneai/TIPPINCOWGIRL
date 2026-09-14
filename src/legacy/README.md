# Legacy: 3D configurator

The react-three-fiber hat configurator (`Configurator.jsx` + `Hat3D.jsx`) that
the layered-photo builder (`src/shop/`) replaced on the page. Nothing imports
these files, so they (and the whole three.js dependency tree) stay out of the
production bundle. They are kept compiling in case the 3D experience comes
back; to remount it, import `src/legacy/Configurator.jsx` from `App.jsx`.
