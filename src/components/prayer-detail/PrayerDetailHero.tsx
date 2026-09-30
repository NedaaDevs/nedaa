import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";
import { ArrowDownUp } from "lucide-react-native";

import { PRAYER_ICONS } from "@/components/today/prayerIcons";
import { ActionsheetTitle } from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { COUNT_AXIS } from "@/constants/Countdown";
import type { PrayerId } from "@/constants/Prayer";
import { usePrayerCountdown } from "@/hooks/useCountdownTimer";
import { useShownDay } from "@/hooks/useShownDay";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { formatPrayerTime } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { formatCount } from "@/utils/focusCount";
import { prayerCards } from "@/utils/prayerCards";
import { prayerNameKey } from "@/utils/prayerName";
import { spokenDuration } from "@/utils/spokenDuration";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

/** The prayer as its Today card shows it, and how long until or since it. */
export const PrayerDetailHero = ({ prayerId }: { prayerId: PrayerId }) => {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const count = usePrayerCountdown(prayerId, flipped);
  const { now, day, following } = useShownDay();
  const locale = useAppStore((state) => state.locale);
  const use24HourTime = usePreferencesStore((state) => state.use24HourTime);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  if (!day) return null;
  const { wide, rest } = prayerCards(day, now, following);
  const card = [wide, ...rest].find((each) => each.id === prayerId);
  if (!card) return null;

  const name = t(prayerNameKey(prayerId, isFridayInTimeZone(parseISO(card.time), day.timezone)));
  const digits = (text: string) => localizeDigits(text, locale, western);
  const until = count?.axis === COUNT_AXIS.UNTIL;

  return (
    <VStack gap="$3" paddingTop="$2">
      {/* The end stays clear for the sheet's close button. */}
      <HStack alignItems="center" gap="$3" paddingEnd="$11">
        <Box
          width="$12"
          height="$12"
          alignItems="center"
          justifyContent="center"
          borderRadius="$pill"
          borderWidth={1}
          borderColor="$accentLine"
          backgroundColor="$accentSoft">
          {/* 22 sits between the ramp's 20 and 24. */}
          <Icon as={PRAYER_ICONS[prayerId]} size={22} strokeWidth={1.65} color="$accent" />
        </Box>
        <VStack flexShrink={1}>
          <ActionsheetTitle>
            <Text size="3xl" bold typography="display" color="$fg">
              {name}
            </Text>
          </ActionsheetTitle>
          <Text size="md" numeric color="$muted">
            {digits(formatPrayerTime(card.time, day.timezone, { locale, use24HourTime }))}
          </Text>
        </VStack>
      </HStack>
      {count && (
        <Pressable
          accessibilityRole="togglebutton"
          accessibilityLabel={t(until ? "a11y.today.untilSpoken" : "a11y.today.sinceSpoken", {
            prayer: name,
            duration: spokenDuration(count, t),
          })}
          accessibilityHint={t(until ? "a11y.today.showElapsed" : "a11y.today.showRemaining")}
          accessibilityState={{ checked: !until }}
          onPress={() => setFlipped((value) => !value)}
          flexDirection="row"
          alignItems="center"
          gap="$3"
          minHeight="$14"
          paddingHorizontal="$3.5"
          paddingVertical="$2.5"
          borderRadius="$card"
          borderWidth={1}
          borderColor="$border"
          backgroundColor="$surface2Soft">
          <Text size="2xl" bold numeric color="$fg">
            {digits(formatCount(count.seconds, count.precise, count.axis))}
          </Text>
          <Text size="sm" color="$muted" flex={1}>
            {t(until ? "today.focus.until" : "today.focus.since", { prayer: name })}
          </Text>
          <Icon as={ArrowDownUp} size="md" color="$muted" />
        </Pressable>
      )}
    </VStack>
  );
};
