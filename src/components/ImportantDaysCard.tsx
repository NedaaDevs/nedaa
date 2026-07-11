import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Directions, Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { useRouter } from "expo-router";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";

import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { upcomingImportantDays } from "@/utils/importantDays";
import { useImportantDayFormat } from "@/hooks/useImportantDayFormat";
import { formatNumberToLocale } from "@/utils/number";
import { useHaptic } from "@/hooks/useHaptic";

// How long each occasion stays before the card cross-fades to the next one.
const DWELL_MS = 10000;
// A manual swipe holds the rotation off long enough to read at leisure.
const PAUSE_AFTER_SWIPE_MS = 20000;

// Opt-in Home rotator: closest occasion first, cross-fading through the rest
// (no sliding — calmer than a carousel). Fling to page manually; tap opens the
// full Important Days tool, which is also the non-gestural a11y path.
const ImportantDaysCard = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const selectionHaptic = useHaptic("selection");
  const enabled = usePreferencesStore((s) => s.showImportantDaysOnHome);
  const hijriDaysOffset = useAppStore((s) => s.hijriDaysOffset);
  const timezone = useLocationStore((s) => s.locationDetails.timezone);
  const [page, setPage] = useState(0);
  const { hijriLabel, remainingLabel, daysUnit } = useImportantDayFormat();
  const reduceMotion = useReducedMotion();
  // Timestamp until which auto-rotation stays paused after a manual swipe.
  // A shared value (not a ref) so the gesture handler can write it without
  // tripping the React Compiler's ref-during-render check.
  const pausedUntil = useSharedValue(0);

  const days = useMemo(
    () => upcomingImportantDays({ timezone, hijriDaysOffset }),
    [timezone, hijriDaysOffset]
  );
  const count = days.length;

  // Rotation: cleared on unmount and whenever a gate condition changes.
  // Reduced motion keeps the card static (swipes still work).
  useEffect(() => {
    if (!enabled || reduceMotion || count <= 1) return;
    const id = setInterval(() => {
      if (Date.now() < pausedUntil.value) return;
      setPage((p) => (p + 1) % count);
    }, DWELL_MS);
    return () => clearInterval(id);
  }, [enabled, reduceMotion, count, pausedUntil]);

  const advance = useCallback(
    (dir: number) => {
      // Shared values are mutable by design; the compiler's immutability check
      // doesn't model reanimated, so it flags this legitimate write.
      // eslint-disable-next-line react-hooks/immutability
      pausedUntil.value = Date.now() + PAUSE_AFTER_SWIPE_MS;
      setPage((p) => (p + dir + count) % count);
      selectionHaptic();
    },
    [count, pausedUntil, selectionHaptic]
  );

  // runOnJS: advance() calls React state setters and haptics, so its onEnd must
  // run on the JS thread — the gesture callbacks are workletized by default.
  const flings = useMemo(
    () =>
      Gesture.Race(
        Gesture.Fling()
          .direction(Directions.LEFT)
          .runOnJS(true)
          .onEnd(() => advance(1)),
        Gesture.Fling()
          .direction(Directions.RIGHT)
          .runOnJS(true)
          .onEnd(() => advance(-1))
      ),
    [advance]
  );

  if (!enabled || count === 0) return null;

  const item = days[page % count];

  return (
    <VStack paddingHorizontal="$4" paddingBottom="$2" gap="$1">
      <GestureDetector gesture={flings}>
        <Pressable
          onPress={async () => {
            await selectionHaptic();
            router.push("/important-days");
          }}
          padding="$4"
          borderRadius="$6"
          backgroundColor="$backgroundSecondary"
          minHeight={72}
          accessibilityRole="button"
          accessibilityLabel={`${t(item.i18nKey)}, ${remainingLabel(item.daysRemaining)}, ${hijriLabel(item)}`}
          accessibilityHint={t("importantDays.title")}>
          <Animated.View
            key={item.id}
            entering={reduceMotion ? undefined : FadeIn.duration(450)}
            exiting={reduceMotion ? undefined : FadeOut.duration(250)}>
            <HStack justifyContent="space-between" alignItems="center">
              <VStack flexShrink={1} marginEnd="$4" gap="$0.5">
                <Text size="md" fontWeight="700" color="$typography">
                  {t(item.i18nKey)}
                </Text>
                <Text size="xs" color="$typographySecondary">
                  {hijriLabel(item)}
                </Text>
              </VStack>
              {item.daysRemaining <= 1 ? (
                <Text size="lg" fontWeight="800" color="$accentPrimary">
                  {remainingLabel(item.daysRemaining)}
                </Text>
              ) : (
                <VStack alignItems="center" minWidth={56}>
                  <Text size="xl" fontWeight="800" color="$accentPrimary">
                    {formatNumberToLocale(String(item.daysRemaining))}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {daysUnit(item.daysRemaining)}
                  </Text>
                </VStack>
              )}
            </HStack>
          </Animated.View>
        </Pressable>
      </GestureDetector>
      <HStack justifyContent="center" gap="$1" accessibilityElementsHidden>
        {days.map((d, i) => (
          <Box
            key={d.id}
            width={6}
            height={6}
            borderRadius={999}
            backgroundColor={i === page ? "$accentPrimary" : "$backgroundMuted"}
          />
        ))}
      </HStack>
    </VStack>
  );
};

export default ImportantDaysCard;
