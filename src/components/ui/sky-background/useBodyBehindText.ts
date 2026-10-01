import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

import type { SkyPaintProps } from "@/components/ui/sky-background/SkyPaint";
import { DURATION_MS } from "@/constants/Motion";
import { BODY_BEHIND_TEXT, CELESTIAL_BODY, MOON_GLYPH, SUN_GLYPH } from "@/constants/Sky";
import { bodyCentre, discOverlaps, type WindowRect } from "@/utils/sky";

type Args = Pick<SkyPaintProps, "scene" | "celestial" | "hijriDay" | "isRTL" | "reduced"> & {
  /** The sky's box, in the points it paints in. */
  width: number;
  height: number;
  /** Text over the sky, in the same points. */
  boxes: readonly WindowRect[];
};

/** The sun's or moon's opacity, lowered while text covers its disc. */
export const useBodyBehindText = ({
  scene,
  celestial,
  hijriDay,
  isRTL,
  reduced,
  width,
  height,
  boxes,
}: Args) => {
  const body = scene.sun
    ? {
        centre: bodyCentre(CELESTIAL_BODY.SUN, scene.sun.disc, width, height, isRTL, celestial),
        radius: SUN_GLYPH.core,
      }
    : scene.moon && hijriDay !== undefined
      ? {
          centre: bodyCentre(
            CELESTIAL_BODY.MOON,
            scene.moon.moon.disc,
            width,
            height,
            isRTL,
            celestial
          ),
          radius: MOON_GLYPH.radius,
        }
      : null;
  const hidden = body !== null && discOverlaps(body.centre.cx, body.centre.cy, body.radius, boxes);
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

  return bodyOpacity;
};
