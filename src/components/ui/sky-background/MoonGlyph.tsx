import { useId } from "react";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

import { SKY_PART } from "@/components/ui/sky-background/parts";
import { MOON_GLYPH } from "@/constants/Sky";
import { litFraction, litsRight, moonPath, moonTilt } from "@/utils/moonPhase";

/** A turn about (cx, cy) as a six-number matrix, skipping the string parser. */
type Matrix = [number, number, number, number, number, number];

const turnAbout = (degrees: number, cx: number, cy: number): Matrix => {
  const [cos, sin] = [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
};

type Props = {
  cx: number;
  cy: number;
  phase: number;
  width: number;
  height: number;
  isRTL: boolean;
};

/** The moon: a pale halo, its faint body, a silver face with seas, a rim. */
export const MoonGlyph = ({ cx, cy, phase, width, height, isRTL }: Props) => {
  const id = useId();
  const { radius: r, face, seas, sea, seaOpacity, rim, earthshine, halo, tiltDegrees } = MOON_GLYPH;
  const lit = moonPath(cx, cy, r, phase, isRTL);
  const lightX = cx + (litsRight(phase, isRTL) ? 1 : -1) * r * 0.4;
  const haloOpacity = halo.dim + (halo.bright - halo.dim) * litFraction(phase);

  return (
    <Svg testID={SKY_PART.MOON} width={width} height={height}>
      <Defs>
        <RadialGradient
          id={`${id}halo`}
          gradientUnits="userSpaceOnUse"
          cx={cx}
          cy={cy}
          r={r * halo.reach}>
          <Stop offset={0.3} stopColor={halo.colour.hex} stopOpacity={1} />
          <Stop offset={1} stopColor={halo.colour.hex} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient
          id={`${id}face`}
          gradientUnits="userSpaceOnUse"
          cx={lightX}
          cy={cy - r * 0.2}
          r={r * 1.7}>
          <Stop offset={0} stopColor={face.light.hex} />
          <Stop offset={1} stopColor={face.edge.hex} />
        </RadialGradient>
        <ClipPath id={`${id}lit`}>
          <Path d={lit} />
        </ClipPath>
      </Defs>
      <Circle
        testID={SKY_PART.MOON_HALO}
        cx={cx}
        cy={cy}
        r={r * halo.reach}
        fill={`url(#${id}halo)`}
        opacity={haloOpacity}
      />
      <G
        testID={SKY_PART.MOON_FACE}
        transform={turnAbout(moonTilt(phase, isRTL, tiltDegrees), cx, cy)}>
        <Circle
          testID={SKY_PART.MOON_BODY}
          cx={cx}
          cy={cy}
          r={r}
          fill={face.edge.hex}
          opacity={earthshine}
        />
        <G clipPath={`url(#${id}lit)`}>
          <Path d={lit} fill={`url(#${id}face)`} />
          {seas.map(([dx, dy, rx, ry]) => (
            <Ellipse
              key={`${dx}:${dy}`}
              cx={cx + dx * r}
              cy={cy + dy * r}
              rx={rx * r}
              ry={ry * r}
              fill={sea.hex}
              opacity={seaOpacity}
            />
          ))}
        </G>
        <Path
          d={lit}
          fill="none"
          stroke={rim.colour.hex}
          strokeWidth={rim.stroke}
          opacity={rim.opacity}
        />
      </G>
    </Svg>
  );
};
