import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";
import { ArrowDownUp } from "lucide-react-native";

import { COUNT_DIRECTION, Countdown, Rolling } from "@/components/ui/countdown";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { APP_STATE } from "@/constants/AppState";
import { COUNT_AXIS } from "@/constants/Countdown";
import { useCountdownTimer } from "@/hooks/useCountdownTimer";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { localizeDigits } from "@/utils/digits";
import { formatCount, type FocusPrayer } from "@/utils/focusCount";
import { prayerNameKey } from "@/utils/prayerName";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

/** The widest figures the block shows, with and without an hour of seconds. */
const WIDEST = { minutes: "00:00", hours: "00:00:00" } as const;

/** The next prayer by name, and how long until it or since the last one. */
export const FocusCountdown = () => {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const count = useCountdownTimer(flipped);
  const locale = useAppStore((state) => state.locale);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  // Each return to the app whirls the figure up from zero again.
  const [opened, setOpened] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === APP_STATE.ACTIVE) setOpened((times) => times + 1);
    });
    return () => subscription.remove();
  }, []);

  if (!count) return null;

  const nameOf = ({ id, time, timezone }: FocusPrayer) =>
    t(prayerNameKey(id, isFridayInTimeZone(time, timezone)));
  const digits = (text: string) => localizeDigits(text, locale, western);
  const until = count.axis === COUNT_AXIS.UNTIL;
  const counted = nameOf(count.counted);

  // Spoken in whole minutes: a screen reader reading seconds would never finish.
  const minutes = Math.max(
    1,
    until ? Math.ceil(count.seconds / 60) : Math.floor(count.seconds / 60)
  );
  const [hours, rest] = [Math.floor(minutes / 60), minutes % 60];
  const hourText = t("common.hour", { count: hours });
  const minuteText = t("common.minute", { count: rest });
  const duration =
    hours && rest
      ? t("a11y.today.durationBoth", { hours: hourText, minutes: minuteText })
      : hours
        ? hourText
        : minuteText;

  return (
    <HStack
      alignItems="flex-end"
      gap="$4"
      paddingBottom="$2"
      borderBottomWidth={1}
      borderColor="$border">
      <VStack flex={1} alignItems="flex-start">
        <Text size="xs" fontWeight="600" color="$accent">
          {t(count.current ? "today.focus.current" : "today.focus.next")}
        </Text>
        <SkyOccluder>
          <Pressable
            accessibilityRole="togglebutton"
            accessibilityLabel={nameOf(count.named)}
            accessibilityHint={t(until ? "a11y.today.showElapsed" : "a11y.today.showRemaining")}
            accessibilityState={{ checked: !until }}
            onPress={() => setFlipped((value) => !value)}
            flexDirection="row"
            alignItems="center"
            gap="$2"
            paddingEnd="$2.5"
            borderRadius="$control">
            <Text size="3xl" bold typography="title" color="$fg">
              {nameOf(count.named)}
            </Text>
            <Icon as={ArrowDownUp} size="xs" color={until ? "$mutedSky" : "$accent"} />
          </Pressable>
        </SkyOccluder>
      </VStack>
      <SkyOccluder>
        <VStack
          accessible
          accessibilityLabel={t(until ? "a11y.today.untilSpoken" : "a11y.today.sinceSpoken", {
            prayer: counted,
            duration,
          })}>
          <Countdown
            value={digits(formatCount(count.seconds, count.precise, count.axis))}
            reserve={digits(count.precise && count.seconds >= 3600 ? WIDEST.hours : WIDEST.minutes)}
            counting={until ? COUNT_DIRECTION.DOWN : COUNT_DIRECTION.UP}
            openKey={opened}
            switchKey={count.axis}
            size="xl"
            bold
            color="$fg"
          />
          <Rolling
            value={t(until ? "today.focus.until" : "today.focus.since", { prayer: counted })}
            size="xs"
            typography="helper"
            color="$mutedSky"
          />
        </VStack>
      </SkyOccluder>
    </HStack>
  );
};
