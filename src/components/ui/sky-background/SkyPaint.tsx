import { useLayoutEffect, useState, type ComponentRef, type Ref } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { MoonGlyph } from "@/components/ui/sky-background/MoonGlyph";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { SunGlyph } from "@/components/ui/sky-background/SunGlyph";
import { useThemeDissolving } from "@/components/ui/theme-transition/context";
import { DURATION_MS } from "@/constants/Motion";
import { CELESTIAL_BODY, type CelestialBody, type SkyDisc } from "@/constants/Sky";
import type { CelestialPosition } from "@/utils/celestial";
import { moonPhaseFor } from "@/utils/moonPhase";
import { bodyCentre, skyBackgroundImage, type SkyScene } from "@/utils/sky";

const HIDDEN_FROM_READER = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
  pointerEvents: "none",
} as const;

export type SkyPaintProps = {
  scene: SkyScene;
  celestial: CelestialPosition | undefined;
  /** The Hijri day that shapes the moon; no moon when it is unknown. */
  hijriDay: number | undefined;
  isRTL: boolean;
  /** Swaps a new sky in at once and holds the sun's rays still. */
  reduced: boolean;
  width: number;
  height: number;
  /** Paints the sky `1 / scale` times larger, shrunk to fit the frame. */
  scale?: number;
  /** Draws the sun or the moon. */
  bodies?: boolean;
  /** The sun's or moon's opacity, lowered while text covers it. */
  bodyOpacity?: Animated.Value;
  /** The canvas's test id. */
  testID?: string;
  ref?: Ref<ComponentRef<typeof View>>;
};

type LayersProps = Omit<SkyPaintProps, "testID" | "ref" | "bodyOpacity"> & {
  scale: number;
  bodies: boolean;
  bodyOpacity: Animated.Value;
};

/** One sky: gradients on a single view, the sun or moon drawn over them. */
const SkyLayers = (props: LayersProps) => {
  const { scene, isRTL, celestial, hijriDay, reduced, bodies, bodyOpacity, scale } = props;
  const [width, height] = [props.width / scale, props.height / scale];
  const box = { width, height };
  const place = (body: CelestialBody, disc: SkyDisc) =>
    bodyCentre(body, disc, width, height, isRTL, celestial);
  // Centred on the frame, so shrinking about the middle fills it exactly.
  const frame =
    scale === 1
      ? StyleSheet.absoluteFill
      : {
          position: "absolute" as const,
          ...box,
          left: (props.width - width) / 2,
          top: (props.height - height) / 2,
          transform: [{ scale }],
        };

  return (
    <View
      testID={SKY_PART.PAINT}
      style={[
        frame,
        {
          backgroundColor: scene.underlay,
          experimental_backgroundImage: skyBackgroundImage(scene, width, height, isRTL, celestial),
        },
      ]}>
      {bodies && (
        <Animated.View
          testID={SKY_PART.BODIES}
          style={[StyleSheet.absoluteFill, { opacity: bodyOpacity }]}>
          {scene.sun && (
            <SunGlyph {...place(CELESTIAL_BODY.SUN, scene.sun.disc)} {...box} reduced={reduced} />
          )}
          {scene.moon && hijriDay !== undefined && (
            <MoonGlyph
              {...place(CELESTIAL_BODY.MOON, scene.moon.moon.disc)}
              phase={moonPhaseFor(hijriDay)}
              isRTL={isRTL}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
};

/** A sky painted from its inputs, filling its parent; a new scene fades in. */
export const SkyPaint = ({
  scale = 1,
  bodies = true,
  bodyOpacity,
  testID = SKY_PART.CANVAS,
  ref,
  ...layers
}: SkyPaintProps) => {
  const { scene, reduced } = layers;
  // A theme dissolve hides the change, so the sky swaps under it.
  const dissolving = useThemeDissolving();
  const [fullBodies] = useState(() => new Animated.Value(1));

  // The sky faded out of, held opaque underneath until the new one covers it.
  const [shown, setShown] = useState(scene);
  const [fadingFrom, setFadingFrom] = useState<SkyScene | null>(null);
  const [opacity] = useState(() => new Animated.Value(1));

  if (scene.key !== shown.key) {
    setShown(scene);
    setFadingFrom(reduced || dissolving ? null : shown);
  }

  // Before paint, so the new sky never shows at full strength for a frame.
  useLayoutEffect(() => {
    if (!fadingFrom) return;
    opacity.setValue(0);
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: DURATION_MS.SKY,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) setFadingFrom(null);
    });
    return () => fade.stop();
  }, [fadingFrom, opacity]);

  const layer = (painted: SkyScene) => (
    <SkyLayers
      {...layers}
      scene={painted}
      scale={scale}
      bodies={bodies}
      bodyOpacity={bodyOpacity ?? fullBodies}
    />
  );

  return (
    <>
      {fadingFrom && (
        <Animated.View {...HIDDEN_FROM_READER} testID={testID} style={StyleSheet.absoluteFill}>
          {layer(fadingFrom)}
        </Animated.View>
      )}
      <Animated.View
        {...HIDDEN_FROM_READER}
        ref={ref}
        testID={testID}
        style={[StyleSheet.absoluteFill, { opacity: fadingFrom ? opacity : 1 }]}>
        {layer(scene)}
      </Animated.View>
    </>
  );
};
