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
  /** Another view on the page draws the sun and moon. */
  claimed: boolean;
  /** The claim came as the sky mounted, so nothing is left to fade. */
  claimedAtOnce: boolean;
};

// Dims the sun or moon behind text, and fades it out while a view claims it.
// `drawn` holds the body on screen until that fade ends.
export const useBodyOpacity = ({
  scene,
  celestial,
  hijriDay,
  isRTL,
  reduced,
  width,
  height,
  boxes,
  claimed,
  claimedAtOnce,
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
  const atOnce = reduced || claimedAtOnce;
  const [drawn, setDrawn] = useState(!claimed);
  // Drawn again before a fade in; a claim taken at once leaves none to fade.
  if (!claimed && !drawn) setDrawn(true);
  if (claimed && atOnce && drawn) setDrawn(false);

  useEffect(() => {
    const target = claimed ? 0 : hidden ? BODY_BEHIND_TEXT.opacity : 1;
    if (atOnce) return bodyOpacity.setValue(target);
    const fade = Animated.timing(bodyOpacity, {
      toValue: target,
      duration: DURATION_MS.GENTLE,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished && claimed) setDrawn(false);
    });
    return () => fade.stop();
  }, [claimed, hidden, atOnce, bodyOpacity]);

  return { bodyOpacity, drawn };
};
