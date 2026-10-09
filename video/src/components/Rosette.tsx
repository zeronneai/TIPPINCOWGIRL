import React from "react";
import { C } from "../theme";

// A western rosette (a concho): scalloped edge, a ring of studs, a stitched
// circle and a star, like the conchos on the hat bands.
export const Rosette: React.FC<{ size: number; color?: string; accent?: string; fill?: string; rotate?: number; style?: React.CSSProperties }> = ({
  size,
  color = C.coralDeep,
  accent = C.coral,
  fill = C.paper,
  rotate = 0,
  style,
}) => {
  const R = 100;
  const petals = 22;
  const studs = 28;
  const star = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 ? 16 : 40;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    return `${R + r * Math.cos(a)},${R + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ transform: `rotate(${rotate}deg)`, ...style }}>
      {Array.from({ length: petals }, (_, i) => {
        const a = (i / petals) * Math.PI * 2;
        return <circle key={i} cx={R + 82 * Math.cos(a)} cy={R + 82 * Math.sin(a)} r={17} fill={color} />;
      })}
      <circle cx={R} cy={R} r={80} fill={fill} stroke={color} strokeWidth={3} />
      {Array.from({ length: studs }, (_, i) => {
        const a = (i / studs) * Math.PI * 2;
        return <circle key={i} cx={R + 68 * Math.cos(a)} cy={R + 68 * Math.sin(a)} r={3.4} fill={color} />;
      })}
      <circle cx={R} cy={R} r={56} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray="7 6" />
      <polygon points={star} fill={accent} />
      <circle cx={R} cy={R} r={9} fill={fill} stroke={color} strokeWidth={3} />
    </svg>
  );
};
