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
import { MoonGlyph } from "@/components/ui/sky-background/MoonGlyph";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { SunGlyph } from "@/components/ui/sky-background/SunGlyph";
import { DURATION_MS } from "@/constants/Motion";
import { CELESTIAL_BODY, type CelestialBody, type SkyDisc } from "@/constants/Sky";
import { BRIGHTNESS } from "@/constants/Palette";
import { usePhase } from "@/contexts/PhaseContext";
import { useRTL } from "@/contexts/RTLContext";
import { useAppIsDark } from "@/hooks/useAppIsDark";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useClockOverride } from "@/hooks/useTodayClock";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { celestialPositionAt, type CelestialPosition } from "@/utils/celestial";
import { phaseAt } from "@/utils/phase";
import { bodyCentre, skyBackgroundImage, skyScene, type SkyScene } from "@/utils/sky";
import { hijriDayAt, moonPhaseFor } from "@/utils/moonPhase";

export { SKY_PART };

const HIDDEN_FROM_READER = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
  pointerEvents: "none",
} as const;

type LayersProps = {
  scene: SkyScene;
  width: number;
  height: number;
  isRTL: boolean;
  celestial: CelestialPosition | undefined;
  /** The Hijri day that shapes the moon; no moon when it is unknown. */
  hijriDay: number | undefined;
  reduced: boolean;
};

/** One sky: gradients on a single view, the sun or moon drawn over them. */
const SkyLayers = (props: LayersProps) => {
  const { scene, width, height, isRTL, celestial, hijriDay, reduced } = props;
  const box = { width, height };
  const place = (body: CelestialBody, disc: SkyDisc) =>
    bodyCentre(body, disc, width, height, isRTL, celestial);

  return (
    <View
      testID={SKY_PART.PAINT}
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: scene.underlay,
          experimental_backgroundImage: skyBackgroundImage(scene, width, height, isRTL, celestial),
        },
      ]}>
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
    </View>
  );
};

type Props = { children?: ReactNode };

/** The screen surface: the sky for the current brightness, phase and hour. */
export const SkyBackground = ({ children }: Props) => {
  const window = useWindowDimensions();
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const { isRTL } = useRTL();
  const reduced = useReducedMotion();
  const clock = useMinuteClock();
  const override = useClockOverride();
  const now = override ?? clock;
  const yesterday = usePrayerTimesStore((state) => state.yesterdayTimings);
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrow = usePrayerTimesStore((state) => state.tomorrowTimings);
  const days = { yesterday, today, tomorrow };
  // A pinned moment paints its own phase; the live one comes from the root.
  const livePhase = usePhase();
  const phase = (override && phaseAt(override, days)) || livePhase;
  const scene = skyScene(useAppIsDark() ? BRIGHTNESS.DARK : BRIGHTNESS.LIGHT, phase);
  const celestial = celestialPositionAt(now, days);
  const hijriOffset = useAppStore((state) => state.hijriDaysOffset);
  const hijriDay = today ? hijriDayAt(now, today.timezone, hijriOffset) : undefined;

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
    <SkyLayers
      scene={painted}
      width={size.width}
      height={size.height}
      isRTL={isRTL}
      celestial={celestial}
      hijriDay={hijriDay}
      reduced={reduced}
    />
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
