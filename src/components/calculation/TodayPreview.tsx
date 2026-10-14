import { addMinutes, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";

import { methodName } from "@/components/calculation/calculationOptions";
import { TUNED_PRAYERS } from "@/components/calculation/tuning";
import { PrayerTimeCell } from "@/components/today/PrayerTimeCell";
import { PrayerTimesState } from "@/components/today/PrayerTimesState";
import { HStack } from "@/components/ui/hstack";
import { SkyHero } from "@/components/ui/sky-preview";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PREVIEW_PRAYERS } from "@/constants/Calculation";
import { PRAYER_ID } from "@/constants/Prayer";
import { useClockTime } from "@/hooks/useClockTime";
import { useDraftTimes } from "@/hooks/useDraftTimes";
import { usePlace } from "@/hooks/usePlace";
import type { AladhanSettings } from "@/types/providers/aladhan";
import { prayerNameKey } from "@/utils/prayerName";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

/** Test id of a previewed prayer's time. */
export const previewTimeId = (prayer: string) => `calculation-preview-${prayer}`;

type Props = { draft: AladhanSettings };

/** Today's times as the draft would move them, or Today's own missing state. */
export const TodayPreview = ({ draft }: Props) => {
  const { t } = useTranslation();
  const { today, source, shift, pending } = useDraftTimes(draft);
  const clock = useClockTime();
  const place = usePlace().name;

  if (!today) return <PrayerTimesState />;

  const friday = isFridayInTimeZone(parseISO(today.timings[PRAYER_ID.DHUHR]), today.timezone);
  const prayers = PREVIEW_PRAYERS.map((prayer) => {
    const time = addMinutes(parseISO(today.timings[prayer]), shift(prayer));
    return { prayer, name: t(prayerNameKey(prayer, friday)), ...clock(time, today.timezone) };
  });
  const adjusted = TUNED_PRAYERS.some((timing) => shift(timing) !== 0);
  // A drafted method has no times to show yet.
  const method = source ? methodName(source.method, t) : undefined;
  const kicker = t(
    adjusted ? "settings.calculation.today.adjusted" : "settings.calculation.today.title"
  );
  const spoken = [
    kicker,
    method,
    place,
    ...prayers.map(({ name, spoken: time }) => t("a11y.join", { first: name, second: time })),
    pending ? t("settings.calculation.today.pending") : undefined,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <SkyHero compact accessibilityLabel={spoken}>
      <VStack gap="$1">
        <Text size="xs" fontWeight="600" color="$mutedSky">
          {kicker}
        </Text>
        <HStack alignItems="flex-end" justifyContent="space-between" gap="$2.5">
          {method ? (
            <Text size="lg" bold typography="title" color="$fg" flexShrink={1}>
              {method}
            </Text>
          ) : null}
          {place ? (
            <Text size="xs" color="$mutedSky" flexShrink={1}>
              {place}
            </Text>
          ) : null}
        </HStack>
        <HStack gap="$2" marginTop="$3" paddingTop="$2.5" borderTopWidth={1} borderColor="$border">
          {prayers.map(({ prayer, name, shown }) => (
            <PrayerTimeCell
              key={prayer}
              name={name}
              time={shown}
              timeTestID={previewTimeId(prayer)}
            />
          ))}
        </HStack>
        {pending ? (
          <Text size="xs" color="$mutedSky" marginTop="$2">
            {t("settings.calculation.today.pending")}
          </Text>
        ) : null}
      </VStack>
    </SkyHero>
  );
};
