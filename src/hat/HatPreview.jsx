import { FELTS, BRIM_PATHS, CROWN, shade, starPath } from "./data.js";

// Live SVG hat preview — recolors and re-decorates from the current build.
// Ported 1:1 from the Design Component's buildHat / buildBand / buildCharm /
// buildMono routines, expressed as JSX.

function Band({ id }) {
  if (id === "none") return null;
  const strip = "M134,216 Q210,234 286,216 L288,244 Q210,260 132,244 Z";

  if (id === "leather")
    return (
      <g>
        <path d={strip} fill="#a9743f" />
        <path d="M135,224 Q210,240 287,224" fill="none" stroke="#7e5326" strokeWidth={2} opacity={0.6} />
      </g>
    );

  if (id === "turquoise")
    return (
      <g>
        <path d={strip} fill="#cdd0d4" />
        {[168, 210, 252].map((x, i) => (
          <ellipse key={i} cx={x} cy={230} rx={13} ry={9} fill="#3fa89a" stroke="#2c7d73" strokeWidth={2} />
        ))}
      </g>
    );

  if (id === "beaded")
    return (
      <g>
        <path d={strip} fill="#d98c9a" />
        {Array.from({ length: 11 }, (_, i) => (
          <circle key={i} cx={142 + i * 15} cy={231} r={4} fill={i % 2 ? "#c25b34" : "#efe6d2"} />
        ))}
      </g>
    );

  if (id === "horsehair")
    return (
      <g>
        <path d={strip} fill="#7a5c44" />
        <path d="M135,226 Q210,242 287,226" fill="none" stroke="#5a4030" strokeWidth={3} opacity={0.6} />
        <path d="M135,234 Q210,250 287,234" fill="none" stroke="#9a7a5c" strokeWidth={2} opacity={0.5} />
      </g>
    );

  return null;
}

function Charm({ id }) {
  if (id === "none") return null;

  if (id === "feather")
    return (
      <g transform="rotate(-15 168 198)">
        <path
          d="M168,238 C147,200 150,162 170,142 C188,164 188,204 176,238 Z"
          fill="#b8451f"
          stroke="#6f2a12"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <path d="M170,142 C178,156 182,176 180,196 C176,182 172,166 170,150 Z" fill="#e9c79a" opacity={0.9} />
        <path d="M170,144 C162,178 164,210 170,236" fill="none" stroke="#f3e2cf" strokeWidth={1.8} opacity={0.9} />
        <path d="M170,236 L175,256" stroke="#6f2a12" strokeWidth={2.5} strokeLinecap="round" />
      </g>
    );

  if (id === "concho")
    return (
      <g>
        <circle cx={166} cy={230} r={15} fill="#d7dadf" stroke="#9aa0a8" strokeWidth={2} />
        <circle cx={166} cy={230} r={8} fill="none" stroke="#9aa0a8" strokeWidth={2} />
        <circle cx={166} cy={230} r={2.5} fill="#9aa0a8" />
      </g>
    );

  if (id === "bloom")
    return (
      <g>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3;
          return <circle key={i} cx={164 + Math.cos(a) * 9} cy={228 + Math.sin(a) * 9} r={6} fill="#d98c9a" />;
        })}
        <circle cx={164} cy={228} r={5} fill="#c79a4e" />
      </g>
    );

  if (id === "star")
    return <path d={starPath(164, 228, 13, 5)} fill="#c79a4e" stroke="#a87f38" strokeWidth={1.5} />;

  return null;
}

function Monogram({ initials }) {
  const t = (initials || "").toUpperCase().slice(0, 3);
  if (!t) return null;
  return (
    <text
      x={226}
      y={238}
      textAnchor="middle"
      fill="#ecca8a"
      style={{ font: "700 21px 'Clash Display', sans-serif", letterSpacing: "3px" }}
    >
      {t}
    </text>
  );
}

export default function HatPreview({ felt, brim, band, charm, initials }) {
  const feltColor = FELTS.find((f) => f.id === felt).color;
  const brimFill = shade(feltColor, -0.16);
  const brimPath = BRIM_PATHS[brim];

  return (
    <svg viewBox="0 0 420 380" width="100%" height="100%" style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id="crownSheen" x1="0" y1="0" x2="1" y2="0.15">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.2} />
          <stop offset="48%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.16} />
        </linearGradient>
        <linearGradient id="brimSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.14} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.18} />
        </linearGradient>
      </defs>

      <path d={brimPath} fill={brimFill} />
      <path d={brimPath} fill="url(#brimSheen)" />
      <path d={CROWN} fill={feltColor} />
      <path d={CROWN} fill="url(#crownSheen)" />
      <path
        d="M210,140 C206,172 206,212 210,252"
        fill="none"
        stroke={shade(feltColor, -0.22)}
        strokeWidth={3}
        opacity={0.32}
        strokeLinecap="round"
      />
      <Band id={band} />
      <Charm id={charm} />
      <Monogram initials={initials} />
    </svg>
  );
}
