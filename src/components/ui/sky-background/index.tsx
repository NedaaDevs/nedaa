import { useLayoutEffect, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { Background } from "@/components/ui/background";
import { DURATION_MS } from "@/constants/Motion";
import { BRIGHTNESS } from "@/constants/Palette";
import { usePhase } from "@/contexts/PhaseContext";
import { useRTL } from "@/contexts/RTLContext";
import { useAppIsDark } from "@/hooks/useAppIsDark";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { skyBackgroundImage, skyScene, type SkyScene } from "@/utils/sky";

/** Test ids for the sky's views; the screen reader sees none of them. */
export const SKY_PART = { CANVAS: "sky-canvas", PAINT: "sky-paint" } as const;

const HIDDEN_FROM_READER = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
  pointerEvents: "none",
} as const;

type LayersProps = { scene: SkyScene; width: number; height: number; isRTL: boolean };

/** One sky: every layer as a native CSS gradient on a single view. */
const SkyLayers = ({ scene, width, height, isRTL }: LayersProps) => (
  <View
    testID={SKY_PART.PAINT}
    style={[
      StyleSheet.absoluteFill,
      {
        backgroundColor: scene.underlay,
        experimental_backgroundImage: skyBackgroundImage(scene, width, height, isRTL),
      },
    ]}
  />
);

type Props = { children?: ReactNode };

/** The screen surface, painted as the sky for the brightness and phase. */
export const SkyBackground = ({ children }: Props) => {
  const window = useWindowDimensions();
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const scene = skyScene(useAppIsDark() ? BRIGHTNESS.DARK : BRIGHTNESS.LIGHT, usePhase());
  const { isRTL } = useRTL();
  const reduced = useReducedMotion();

  // The sky faded out of, held opaque underneath until the new one covers it.
  const [shown, setShown] = useState(scene);
  const [fadingFrom, setFadingFrom] = useState<SkyScene | null>(null);
  const [opacity] = useState(() => new Animated.Value(1));

  if (scene.key !== shown.key) {
    setShown(scene);
    setFadingFrom(reduced ? null : shown);
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

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) =>
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });

  const layer = (painted: SkyScene) => (
    <SkyLayers scene={painted} width={size.width} height={size.height} isRTL={isRTL} />
  );

  return (
    <Background onLayout={onLayout}>
      {fadingFrom && (
        <Animated.View
          {...HIDDEN_FROM_READER}
          testID={SKY_PART.CANVAS}
          style={StyleSheet.absoluteFill}>
          {layer(fadingFrom)}
        </Animated.View>
      )}
      <Animated.View
        {...HIDDEN_FROM_READER}
        testID={SKY_PART.CANVAS}
        style={[StyleSheet.absoluteFill, { opacity: fadingFrom ? opacity : 1 }]}>
        {layer(scene)}
      </Animated.View>
      {children}
    </Background>
  );
};
