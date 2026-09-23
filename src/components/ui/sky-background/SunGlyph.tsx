import { useEffect, useId, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

import { SKY_PART } from "@/components/ui/sky-background/parts";
import { SUN_GLYPH } from "@/constants/Sky";

type Props = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  /** Holds the rays still. */
  reduced: boolean;
};

const DEGREES = Math.PI / 180;

/** A wedge from the centre of a `2 * reach` box out along `angle`. */
const rayPath = (reach: number, length: number, angle: number, halfAngle: number) => {
  const [a1, a2] = [(angle - halfAngle) * DEGREES, (angle + halfAngle) * DEGREES];
  return (
    `M ${reach} ${reach} ` +
    `L ${reach + Math.cos(a1) * length} ${reach + Math.sin(a1) * length} ` +
    `L ${reach + Math.cos(a2) * length} ${reach + Math.sin(a2) * length} Z`
  );
};

/** The sun: slow faint rays behind a wide white bloom and a blown-out core. */
export const SunGlyph = ({ cx, cy, width, height, reduced }: Props) => {
  const id = useId();
  const { colour, core, bloom, rays, spinMs } = SUN_GLYPH;
  const white = colour.hex;
  const reach = Math.max(...rays.lengths);
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) return;
    const turning = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: spinMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    turning.start();
    return () => turning.stop();
  }, [reduced, spin, spinMs]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const step = 360 / rays.lengths.length;

  return (
    <View testID={SKY_PART.SUN} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        testID={SKY_PART.SUN_RAYS}
        style={[
          { position: "absolute", left: cx - reach, top: cy - reach },
          { width: reach * 2, height: reach * 2 },
          reduced ? null : { transform: [{ rotate }] },
        ]}>
        <Svg width={reach * 2} height={reach * 2}>
          <Defs>
            <RadialGradient
              id={`${id}ray`}
              gradientUnits="userSpaceOnUse"
              cx={reach}
              cy={reach}
              r={reach}>
              <Stop offset={0} stopColor={white} stopOpacity={0.12} />
              <Stop offset={0.5} stopColor={white} stopOpacity={0.04} />
              <Stop offset={1} stopColor={white} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {rays.lengths.map((length, i) => (
            <Path
              key={i}
              d={rayPath(reach, length, i * step + rays.offset, rays.halfAngle)}
              fill={`url(#${id}ray)`}
            />
          ))}
        </Svg>
      </Animated.View>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id={`${id}bloom`}
            gradientUnits="userSpaceOnUse"
            cx={cx}
            cy={cy}
            r={bloom}>
            <Stop offset={0} stopColor={white} stopOpacity={0.95} />
            <Stop offset={0.12} stopColor={white} stopOpacity={0.45} />
            <Stop offset={0.32} stopColor={white} stopOpacity={0.12} />
            <Stop offset={1} stopColor={white} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}core`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={core}>
            <Stop offset={0} stopColor={white} />
            <Stop offset={0.55} stopColor={white} />
            <Stop offset={1} stopColor={white} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={bloom} fill={`url(#${id}bloom)`} />
        <Circle cx={cx} cy={cy} r={core} fill={`url(#${id}core)`} />
      </Svg>
    </View>
  );
};
