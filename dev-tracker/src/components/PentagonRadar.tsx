import React from 'react';
import Svg, { Path, Circle, Line, Text as SvgText, Polygon } from 'react-native-svg';
import { DayScore } from '../lib/types';
import { COLORS, FONTS } from '../lib/theme';

interface Props {
  score: DayScore;
  size?: number;
  showLabels?: boolean;
  showCenter?: boolean;
}

const AXES = [
  { label: 'CIBLE', max: 3, key: 'mission' as keyof DayScore },
  { label: 'VOIES', max: 3, key: 'voies' as keyof DayScore },
  { label: 'RITES', max: 2, key: 'rites' as keyof DayScore },
  { label: 'DÉRIVES', max: 1, key: 'derives' as keyof DayScore },
  { label: 'MAÎTRISE', max: 1, key: 'maitrise' as keyof DayScore },
];

function polarToCart(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function PentagonRadar({ score, size = 160, showLabels = true, showCenter = true }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - (showLabels ? 28 : 8);
  const n = AXES.length;
  const angleStep = 360 / n;

  // Build pentagon points for a given radius fraction
  function pentPoints(fraction: number) {
    return AXES.map((_, i) => {
      const pt = polarToCart(cx, cy, maxR * fraction, i * angleStep);
      return `${pt.x},${pt.y}`;
    }).join(' ');
  }

  // Score polygon
  const scorePoints = AXES.map((axis, i) => {
    const val = Number(score[axis.key]) || 0;
    const fraction = val / axis.max;
    const pt = polarToCart(cx, cy, maxR * fraction, i * angleStep);
    return `${pt.x},${pt.y}`;
  }).join(' ');

  // Guide lines from center
  const guideLines = AXES.map((_, i) => {
    const tip = polarToCart(cx, cy, maxR, i * angleStep);
    return <Line key={i} x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke={COLORS.inkBorder} strokeWidth={0.5} />;
  });

  // Labels
  const labels = showLabels
    ? AXES.map((axis, i) => {
        const labelR = maxR + 14;
        const pt = polarToCart(cx, cy, labelR, i * angleStep);
        return (
          <SvgText
            key={i}
            x={pt.x}
            y={pt.y}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={6}
            fontFamily={FONTS.mono}
            fill={COLORS.creamMuted}
          >
            {axis.label}
          </SvgText>
        );
      })
    : null;

  const totalStr = score.sceauZero ? '0' : String(score.total);

  return (
    <Svg width={size} height={size}>
      {/* Guide pentagons */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <Polygon
          key={f}
          points={pentPoints(f)}
          fill="none"
          stroke={COLORS.inkBorder}
          strokeWidth={f === 1 ? 1 : 0.5}
        />
      ))}

      {guideLines}

      {/* Score fill */}
      <Polygon
        points={scorePoints}
        fill={COLORS.amberGlow}
        stroke={COLORS.amber}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Axis dots */}
      {AXES.map((axis, i) => {
        const val = Number(score[axis.key]) || 0;
        const fraction = val / axis.max;
        const pt = polarToCart(cx, cy, maxR * fraction, i * angleStep);
        return (
          <Circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill={COLORS.amber} />
        );
      })}

      {labels}

      {/* Center score */}
      {showCenter && (
        <>
          <Circle cx={cx} cy={cy} r={16} fill={COLORS.inkSurface} />
          <SvgText
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={12}
            fontFamily={FONTS.monoBold}
            fill={COLORS.amber}
          >
            {totalStr}
          </SvgText>
          <SvgText
            x={cx}
            y={cy + 9}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={5}
            fontFamily={FONTS.mono}
            fill={COLORS.creamMuted}
          >
            /10
          </SvgText>
        </>
      )}
    </Svg>
  );
}
