import { use, useEffect, useEffectEvent, useRef } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { PrayerGrid } from "@/components/today/PrayerGrid";
import { TodayHero } from "@/components/today/TodayHero";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { DURATION_MS } from "@/constants/Motion";
import { TODAY_STYLE } from "@/constants/Today";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SampleDaysContext } from "@/hooks/useStoredDays";
import { useTodayClock } from "@/hooks/useTodayClock";
import { useTodayStored } from "@/hooks/useTodayStored";
import { usePreferencesStore } from "@/stores/preferences";
import { sampleDays } from "@/utils/sampleDays";

export const TODAY_STYLE_PREVIEW_PART = {
  ROOT: "today-style-preview",
  SAMPLE_NOTE: "today-style-preview-sample-note",
} as const;

const NO_TOUCHES = { pointerEvents: "none" } as const;
const NOTHING = () => {};

type Props = {
  /** Draws a sample day unless the user's own times are stored. */
  sampleUnlessOwn?: boolean;
};

/** Today's head in the chosen style; Simple adds the lit card and its bar. */
export const TodayStylePreview = ({ sampleUnlessOwn = false }: Props) => {
  const { t } = useTranslation();
  const todayStyle = usePreferencesStore((state) => state.todayStyle);
  // Times for the default place are not the user's.
  const own = useTodayStored();
  const now = useTodayClock();
  // Days held above it, such as a day run's, so the preview and the sky agree.
  const heldDays = use(SampleDaysContext);
  const sample = sampleUnlessOwn && !own;

  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  const shown = useRef(todayStyle);
  // A new style fades in over the old one's place; Reduce Motion swaps at once.
  const fade = useEffectEvent(() => {
    if (shown.current === todayStyle) return;
    shown.current = todayStyle;
    if (reduced) return;
    opacity.set(0);
    opacity.set(withTiming(1, { duration: DURATION_MS.GENTLE }));
  });
  useEffect(() => {
    fade();
  }, [todayStyle]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  const preview = (
    <Animated.View testID={TODAY_STYLE_PREVIEW_PART.ROOT} style={style}>
      <VStack gap="$3.5">
        <TodayHero todayStyle={todayStyle} />
        {todayStyle === TODAY_STYLE.SIMPLE ? (
          // The countdown names the prayer; its card here only shows the bar.
          <View style={NO_TOUCHES} {...HIDDEN_FROM_READER}>
            <PrayerGrid nextOnly progress onSelect={NOTHING} />
          </View>
        ) : null}
      </VStack>
    </Animated.View>
  );

  if (!sample) return preview;

  // Sample times are not the user's, so no reader hears them as such.
  return (
    <SampleDaysContext value={heldDays ?? sampleDays(now)}>
      <VStack gap="$2">
        <View style={NO_TOUCHES} {...HIDDEN_FROM_READER}>
          {preview}
        </View>
        <Text
          testID={TODAY_STYLE_PREVIEW_PART.SAMPLE_NOTE}
          size="sm"
          color="$mutedSky"
          textAlign="center">
          {t("onboarding.appearance.sampleTimes")}
        </Text>
      </VStack>
    </SampleDaysContext>
  );
};
