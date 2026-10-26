import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";

import { HighlightEdge, useElevationShadow } from "@/components/ui/material/edge";
import { Pill, PILL_TONE } from "@/components/ui/pill";
import { Text } from "@/components/ui/text";
import { useIsDarkTheme } from "@/components/ui/theme-color";
import { VStack } from "@/components/ui/vstack";
import { ELEVATION_LEVEL } from "@/constants/Elevation";
import { BRIGHTNESS, PLACE_HERO_PAINT, type Brightness } from "@/constants/Palette";
import type { PlaceHeroTone } from "@/constants/PlaceHero";

/** Test ids for the hero's parts. */
export const PLACE_HERO_PART = {
  FRAME: "place-hero",
  PAINT: "place-hero-paint",
  SKYLINE: "place-hero-skyline",
  SCENERY: "place-hero-scenery",
} as const;

/** The note's ink: full over the light skyline's shade, set back on dark. */
export const HERO_NOTE_INK: Record<Brightness, number> = {
  [BRIGHTNESS.LIGHT]: 1,
  [BRIGHTNESS.DARK]: 0.8,
};

/** The skyline: drawn this tall, and overhanging each side by this share. */
const SKYLINE = {
  height: 70,
  overhang: 0.04,
  drop: 2,
  viewBox: "0 0 420 90",
  path: "M0 91V53l34-18 20 10 28-27 39 22 30-18 27 17 41-33 42 32 35-16 39 20 29-23 36 21v51Z",
} as const;

/** Not for a screen reader: the hero reads as its words alone. */
const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

type Props = {
  tone: PlaceHeroTone;
  kicker: string;
  /** The place, or a question while none is known; it wraps when long. */
  title: string;
  subtitle: string;
};

/** The place the times are for, on its tone's tinted sky with a skyline. */
export const PlaceHero = ({ tone, kicker, title, subtitle }: Props) => {
  const { t } = useTranslation();
  const dark = useIsDarkTheme();
  const lift = useElevationShadow(ELEVATION_LEVEL.E1);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const brightness = dark ? BRIGHTNESS.DARK : BRIGHTNESS.LIGHT;
  const paint = PLACE_HERO_PAINT[tone][brightness];
  const stops = paint.stops.map(({ color, at }) => `${color.hex} ${at}%`).join(", ");

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) =>
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });

  return (
    <VStack
      testID={PLACE_HERO_PART.FRAME}
      accessible
      accessibilityLabel={t("a11y.join", {
        first: t("a11y.join", { first: kicker, second: title }),
        second: subtitle,
      })}
      onLayout={onLayout}
      padding="$cardPad"
      borderRadius="$hero"
      overflow="hidden"
      style={{ boxShadow: lift }}>
      <View
        testID={PLACE_HERO_PART.PAINT}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: paint.stops[paint.stops.length - 1].color.hex,
            experimental_backgroundImage: `linear-gradient(${paint.angle}deg, ${stops})`,
          },
        ]}
      />
      {size.width > 0 ? (
        // The page sky holds the one sun or moon; the hero draws none.
        <View testID={PLACE_HERO_PART.SCENERY} pointerEvents="none" style={styles.fill} {...HIDDEN}>
          <View testID={PLACE_HERO_PART.SKYLINE} style={styles.skyline}>
            <Svg
              width={size.width * (1 + 2 * SKYLINE.overhang)}
              height={SKYLINE.height}
              viewBox={SKYLINE.viewBox}
              preserveAspectRatio="none"
              style={{ marginLeft: -size.width * SKYLINE.overhang }}>
              <Path fill={paint.skyline.hex} d={SKYLINE.path} />
            </Svg>
          </View>
        </View>
      ) : null}
      <HighlightEdge owner={PLACE_HERO_PART.FRAME} radius="$hero" />
      <Pill dot tone={PILL_TONE.NEUTRAL} alignSelf="flex-start">
        {kicker}
      </Pill>
      <Text size="heading" bold typography="title" color="$fg" marginTop="$11">
        {title}
      </Text>
      <Text
        size="helper"
        fontWeight="500"
        typography="helper"
        color="$fg"
        opacity={HERO_NOTE_INK[brightness]}
        marginTop="$0.5">
        {subtitle}
      </Text>
    </VStack>
  );
};

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, direction: "ltr" },
  skyline: { position: "absolute", left: 0, right: 0, bottom: -SKYLINE.drop },
});
