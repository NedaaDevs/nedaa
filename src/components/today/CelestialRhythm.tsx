import { useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";

import { Bowl, type BowlBody } from "@/components/today/Bowl";
import { Box } from "@/components/ui/box";
import { usePageSky } from "@/components/ui/sky-background/useLiveSky";
import { VStack } from "@/components/ui/vstack";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { CELESTIAL_BODY } from "@/constants/Sky";
import { BOWL, TICK_STATE } from "@/constants/Timeline";
import { useShownDay } from "@/hooks/useShownDay";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { localizeDigits } from "@/utils/digits";
import { moonPhaseFor } from "@/utils/moonPhase";
import { prayerNameKey } from "@/utils/prayerName";
import { rhythmLine, type RhythmTimingId } from "@/utils/rhythm";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

export const RHYTHM_PART = { ROOT: "celestial-rhythm" } as const;
export const BOWL_FRAME_PART = { FRAME: "bowl-frame", INSIDE: "bowl-inside" } as const;

type Props = {
  /** The prayer whose card is chosen; its mark stays ringed. */
  selected?: PrayerId;
  /** Fades the bowl while a state panel covers the day. */
  dimmed?: boolean;
  /** What the bowl holds, centred under its crest: the countdown. */
  children?: ReactNode;
};

/** The prayer day as a bowl: Fajr to Isha by day, walked back by night. */
export const CelestialRhythm = ({ selected, dimmed, children }: Props) => {
  const { t } = useTranslation();
  const { now, day: today, following } = useShownDay();
  const { scene, hijriDay } = usePageSky();
  const locale = useAppStore((state) => state.locale);
  const western = usePreferencesStore((state) => state.useWesternNumerals);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  if (!today) return null;

  const friday = isFridayInTimeZone(now, today.timezone);
  const nameOf = (id: RhythmTimingId) => {
    if (id === OTHER_TIMING.SUNRISE) return t("otherTimings.sunrise");
    return t(prayerNameKey(id, friday));
  };

  const line = rhythmLine(today, now, following);
  const current = line.marks.find((mark) => mark.state === TICK_STATE.CURRENT)?.id;
  const next = line.marks.find(
    (mark) => mark.state === TICK_STATE.FUTURE && mark.id !== OTHER_TIMING.SUNRISE
  )?.id;

  const summary = (() => {
    if (line.night) {
      const percent = String(Math.round((1 - line.now) * 100));
      return t("a11y.rhythm.night", {
        percent: localizeDigits(percent, locale, western),
        prayer: nameOf(PRAYER_ID.FAJR),
      });
    }
    if (current === undefined) {
      return t("a11y.rhythm.beforeFajr", { prayer: nameOf(PRAYER_ID.FAJR) });
    }
    if (current === OTHER_TIMING.SUNRISE) {
      return t("a11y.rhythm.afterSunrise", { prayer: nameOf(PRAYER_ID.DHUHR) });
    }
    return t("a11y.rhythm.currentNext", {
      prayer: nameOf(current),
      next: nameOf(next ?? PRAYER_ID.ISHA),
    });
  })();

  // The moon rides the rim by night and on a dark sky; else the sun.
  const body = ((): BowlBody | null => {
    if (!line.night && scene.sun) return { body: CELESTIAL_BODY.SUN };
    return hijriDay === undefined
      ? null
      : { body: CELESTIAL_BODY.MOON, phase: moonPhaseFor(hijriDay) };
  })();

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) =>
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });

  return (
    <View testID={BOWL_FRAME_PART.FRAME} style={styles.frame} onLayout={onLayout}>
      <Box
        testID={RHYTHM_PART.ROOT}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={summary}
        opacity={dimmed ? 0.35 : 1}
        style={StyleSheet.absoluteFill}>
        {size ? (
          <Bowl
            line={line}
            {...size}
            selected={selected}
            body={body}
            feet={{ start: nameOf(PRAYER_ID.FAJR), end: nameOf(PRAYER_ID.ISHA) }}
          />
        ) : null}
      </Box>
      <VStack testID={BOWL_FRAME_PART.INSIDE} paddingTop={BOWL.insideTop} alignItems="center">
        {children}
      </VStack>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: { minHeight: BOWL.leastHeight },
});
