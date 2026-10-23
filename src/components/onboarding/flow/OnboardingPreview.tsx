import { useEffect, useEffectEvent } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";

import { OnboardingCard } from "@/components/onboarding/flow/OnboardingCard";
import { FocusCountdown } from "@/components/today/FocusCountdown";
import { PrayerTimeCell } from "@/components/today/PrayerTimeCell";
import { HStack } from "@/components/ui/hstack";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { EASE_IN_OUT_CURVE, LOOP_FOREVER } from "@/constants/Motion";
import { ONBOARDING_PART, PREVIEW_MOTION, TIME_PLACEHOLDER } from "@/constants/Onboarding";
import { PRAYER_ID, PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import { useClockTime } from "@/hooks/useClockTime";
import { useFocusPrayer } from "@/hooks/useFocusPrayer";
import { usePlace } from "@/hooks/usePlace";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useShownDay } from "@/hooks/useShownDay";
import { useTodayDates } from "@/hooks/useTodayDates";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { prayerNameKey } from "@/utils/prayerName";
import { spokenDuration } from "@/utils/spokenDuration";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

const AT_ONCE = { duration: 0 };
const NO_TOUCHES = { pointerEvents: "none" } as const;
// Half a pulse each way; the repeat reverses it.
const PULSE_HALF = {
  duration: PREVIEW_MOTION.PULSE_MS / 2,
  easing: Easing.bezier(...EASE_IN_OUT_CURVE),
};

type ChipProps = {
  id: PrayerId;
  name: string;
  time: string;
  index: number;
  next: boolean;
  muted: boolean;
};

/** One prayer's chip; its value fades in place, so the chip keeps its size. */
const PreviewChip = ({ id, name, time, index, next, muted }: ChipProps) => {
  const reduced = useReducedMotion();
  // Starts hidden, so a mount fades in without a blink first.
  const opacity = useSharedValue(reduced ? 1 : 0);

  const fade = useEffectEvent(() => {
    opacity.set(
      reduced
        ? 1
        : withSequence(
            withTiming(0, AT_ONCE),
            withDelay(
              index * PREVIEW_MOTION.STAGGER_MS,
              withTiming(1, { duration: PREVIEW_MOTION.FADE_MS })
            )
          )
    );
  });
  useEffect(() => {
    fade();
  }, [time]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <VStack
      testID={`${ONBOARDING_PART.PREVIEW_CHIP}-${id}`}
      flex={1}
      paddingVertical="$1.5"
      borderRadius="$control"
      borderWidth={1}
      borderColor={next ? "$accent" : "transparent"}
      backgroundColor={next ? "$accentSoft" : "$surface2"}>
      <PrayerTimeCell name={name} time={time} centered muted={muted} timeStyle={style} />
    </VStack>
  );
};

type Props = {
  /** Shown in the place line in its place, such as a locating note. */
  placeNote?: string;
  /** Shown in the no-times line in its place, such as a loading note. */
  timesNote?: string;
  /** The times are being fetched: the row pulses and its values are muted. */
  loading?: boolean;
};

/** A small Today: dates, place, the focus prayer and the five times. */
export const OnboardingPreview = ({ placeNote, timesNote, loading = false }: Props) => {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.set(
      loading && !reduced
        ? withRepeat(withTiming(PREVIEW_MOTION.PULSE_OPACITY, PULSE_HALF), LOOP_FOREVER, true)
        : 1
    );
  }, [loading, reduced, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  const dates = useTodayDates();
  const place = usePlace();
  const focusPrayer = useFocusPrayer();
  const { day: shownDay } = useShownDay();
  // Times for the default place are not the user's, so the preview shows none.
  const usingDefault = usePrayerTimesStore((state) => state.usingDefaultLocation);
  const day = usingDefault ? null : shownDay;
  const focus = day ? focusPrayer : null;
  const clock = useClockTime();

  const placeLine = placeNote ?? place.name ?? t("onboarding.preview.noCity");
  const noTimesLine = timesNote ?? t("onboarding.preview.noTimes");
  const friday = day
    ? isFridayInTimeZone(parseISO(day.timings[PRAYER_ID.DHUHR]), day.timezone)
    : false;
  const chips = PRAYER_IDS.map((id) => {
    const name = t(prayerNameKey(id, friday));
    const time = day ? clock(parseISO(day.timings[id]), day.timezone) : null;
    return {
      id,
      name,
      shown: time?.shown ?? TIME_PLACEHOLDER,
      spoken: time ? t("a11y.join", { first: name, second: time.spoken }) : null,
    };
  });
  const focusLine = focus
    ? t("a11y.join", {
        first: t("a11y.join", { first: focus.label, second: focus.name }),
        second: spokenDuration(focus.count, t),
      })
    : null;
  const label = [
    dates.hijri,
    dates.gregorian,
    placeLine,
    ...(day ? [focusLine, ...chips.map(({ spoken }) => spoken)] : [noTimesLine]),
  ]
    .filter((part): part is string => Boolean(part))
    .reduce((first, second) => t("a11y.join", { first, second }));

  return (
    <SkyOccluder>
      <OnboardingCard
        testID={ONBOARDING_PART.PREVIEW}
        accessible
        accessibilityLabel={label}
        gap="$2"
        padding="$3">
        <HStack gap="$2" flexWrap="wrap">
          <Text size="xs" color="$mutedSky">
            {dates.hijri}
          </Text>
          <Text size="xs" color="$mutedSky">
            {dates.gregorian}
          </Text>
        </HStack>
        <Text size="sm" fontWeight="600" color="$fg">
          {placeLine}
        </Text>
        {day ? (
          // Today's own focus block; the card speaks for it.
          <View style={NO_TOUCHES} {...HIDDEN_FROM_READER}>
            <FocusCountdown />
          </View>
        ) : (
          <Text size="sm" color="$mutedSky">
            {noTimesLine}
          </Text>
        )}
        <Animated.View testID={ONBOARDING_PART.PREVIEW_TIMES} style={pulseStyle}>
          <HStack gap="$1.5">
            {chips.map((chip, index) => (
              <PreviewChip
                key={chip.id}
                id={chip.id}
                name={chip.name}
                time={chip.shown}
                index={index}
                next={focus?.count.named.id === chip.id}
                muted={loading}
              />
            ))}
          </HStack>
        </Animated.View>
      </OnboardingCard>
    </SkyOccluder>
  );
};
