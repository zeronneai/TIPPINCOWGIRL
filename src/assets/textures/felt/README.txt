Drop tileable felt PBR maps here (auto-detected at build time, zero requests when absent):

  felt-albedo.jpg     optional - keep ~neutral/grey; multiplied by the felt color
  felt-normal.jpg     the wool weave - replaces the procedural bump (biggest win)
  felt-roughness.jpg  micro sheen variation

.png/.webp also work. Square 1024 or 2048, seamless, OpenGL-convention normals.
Tiling is FELT_REPEAT (6x) at the top of src/hat/Hat3D.jsx.
