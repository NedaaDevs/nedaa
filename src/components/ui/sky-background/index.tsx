import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
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
import {
  SkyOccluder,
  SkyOccluderContext,
  SkyScrollView,
} from "@/components/ui/sky-background/occluder";
import { SKY_PART } from "@/components/ui/sky-background/parts";
import { SunGlyph } from "@/components/ui/sky-background/SunGlyph";
import { DURATION_MS } from "@/constants/Motion";
import { AppMode } from "@/enums/app";
import {
  BODY_BEHIND_TEXT,
  CELESTIAL_BODY,
  MOON_GLYPH,
  SUN_GLYPH,
  type CelestialBody,
  type SkyDisc,
} from "@/constants/Sky";
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
import { measureInWindow } from "@/utils/measureInWindow";
import {
  bodyCentre,
  discOverlaps,
  skyBackgroundImage,
  skyScene,
  type SkyScene,
  type WindowRect,
} from "@/utils/sky";
import { hijriDayAt, moonPhaseFor } from "@/utils/moonPhase";

export { SKY_PART, SkyOccluder, SkyScrollView };

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
  /** The sun's or moon's opacity, lowered while text covers it. */
  bodyOpacity: Animated.Value;
};

/** One sky: gradients on a single view, the sun or moon drawn over them. */
const SkyLayers = (props: LayersProps) => {
  const { scene, width, height, isRTL, celestial, hijriDay, reduced, bodyOpacity } = props;
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
  // Only Adaptive tints by phase; a fixed brightness keeps its plain sky.
  const adaptive = useAppStore((state) => state.mode) === AppMode.ADAPTIVE;
  const brightness = useAppIsDark() ? BRIGHTNESS.DARK : BRIGHTNESS.LIGHT;
  const scene = skyScene(brightness, adaptive ? phase : undefined);
  const celestial = celestialPositionAt(now, days);
  const hijriOffset = useAppStore((state) => state.hijriDaysOffset);
  const hijriDay = today ? hijriDayAt(now, today.timezone, hijriOffset) : undefined;

  // The sky faded out of, held opaque underneath until the new one covers it.
  const [shown, setShown] = useState(scene);
  const [fadingFrom, setFadingFrom] = useState<SkyScene | null>(null);
  const [opacity] = useState(() => new Animated.Value(1));

  // Text blocks over the sky, in window points, and where the sky itself sits.
  const [boxes, setBoxes] = useState<Record<string, WindowRect>>({});
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [epoch, setEpoch] = useState(0);
  const canvas = useRef<ComponentRef<typeof View>>(null);
  // Stable, and a no-op for an unchanged box, so measuring never loops a render.
  const [report] = useState(
    () => (id: string, box: WindowRect | null) =>
      setBoxes((current) => {
        const { [id]: old, ...rest } = current;
        if (!box) return old ? rest : current;
        const same =
          old && (Object.keys(box) as (keyof WindowRect)[]).every((k) => old[k] === box[k]);
        return same ? current : { ...rest, [id]: box };
      })
  );
  const registry = { report, epoch, remeasure: () => setEpoch((value) => value + 1) };

  const body = scene.sun
    ? {
        centre: bodyCentre(
          CELESTIAL_BODY.SUN,
          scene.sun.disc,
          size.width,
          size.height,
          isRTL,
          celestial
        ),
        radius: SUN_GLYPH.core,
      }
    : scene.moon && hijriDay !== undefined
      ? {
          centre: bodyCentre(
            CELESTIAL_BODY.MOON,
            scene.moon.moon.disc,
            size.width,
            size.height,
            isRTL,
            celestial
          ),
          radius: MOON_GLYPH.radius,
        }
      : null;
  const onSky = Object.values(boxes).map(({ x, y, width, height }) => ({
    x: x - origin.x,
    y: y - origin.y,
    width,
    height,
  }));
  const hidden = body !== null && discOverlaps(body.centre.cx, body.centre.cy, body.radius, onSky);
  const [bodyOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const target = hidden ? BODY_BEHIND_TEXT.opacity : 1;
    if (reduced) return bodyOpacity.setValue(target);
    const fade = Animated.timing(bodyOpacity, {
      toValue: target,
      duration: DURATION_MS.GENTLE,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [hidden, reduced, bodyOpacity]);

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

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
    void measureInWindow(canvas.current).then((box) => box && setOrigin(box));
  };

  const layer = (painted: SkyScene) => (
    <SkyLayers
      scene={painted}
      width={size.width}
      height={size.height}
      isRTL={isRTL}
      celestial={celestial}
      hijriDay={hijriDay}
      reduced={reduced}
      bodyOpacity={bodyOpacity}
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
        ref={canvas}
        testID={SKY_PART.CANVAS}
        style={[StyleSheet.absoluteFill, { opacity: fadingFrom ? opacity : 1 }]}>
        {layer(scene)}
      </Animated.View>
      <SkyOccluderContext value={registry}>{children}</SkyOccluderContext>
    </Background>
  );
};
