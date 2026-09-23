import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { useTodayClock } from "@/hooks/useTodayClock";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { HijriNative, getDateLocale } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";

/** Today's top: the brand, then the dates at the start and place at the end. */
export const TodayHeader = () => {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const hijriOffset = useAppStore((state) => state.hijriDaysOffset);
  const useWesternNumerals = usePreferencesStore((state) => state.useWesternNumerals);
  const { localizedLocation, locationDetails } = useLocationStore();
  // Re-renders on the minute so the dates turn over at midnight; a store
  // screenshot holds its seeded moment instead.
  const now = useTodayClock();

  const digits = (text: string) => localizeDigits(text, locale, useWesternNumerals);
  const timezone = locationDetails.timezone;
  const zonedNow = toZonedTime(now, timezone);
  const dateLocale = getDateLocale(locale);

  // hijri-native reads Unix seconds.
  const today = HijriNative.fromTimestamp(Math.floor(now.getTime() / 1000), timezone);
  const hijri = hijriOffset === 0 ? today : HijriNative.addDays(today, hijriOffset);
  const hijriDate = digits(`${hijri.day} ${t(`hijriMonths.${hijri.month - 1}`)} ${hijri.year}`);
  const gregorian = t("today.gregorianDate", {
    day: format(zonedNow, "EEEE", { locale: dateLocale }),
    date: digits(format(zonedNow, "d MMMM yyyy", { locale: dateLocale })),
  });

  // The localized name follows the app language; the address is English-only.
  const city = localizedLocation.city ?? locationDetails.address?.city;
  const country = localizedLocation.country ?? locationDetails.address?.country;

  return (
    <VStack gap="$3.5">
      <Text size="md" bold color="$fg">
        {t("brand.name")}
      </Text>
      <HStack justifyContent="space-between" alignItems="flex-end" gap="$3">
        <VStack gap="$1" flexShrink={1}>
          <Text accessibilityRole="header" size="3xl" bold typography="title" color="$fg">
            {hijriDate}
          </Text>
          <Text size="sm" typography="helper" color="$mutedSky">
            {gregorian}
          </Text>
        </VStack>
        {city ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("a11y.location.currentCity", { city })}
            accessibilityHint={t("a11y.today.locationHint")}
            onPress={() => router.push(BACK_DESTINATION.SETTINGS_LOCATION.href)}
            alignItems="flex-end"
            justifyContent="flex-end"
            flexShrink={1}>
            <Text size="sm" bold typography="helper" color="$fg" numberOfLines={1}>
              {city}
            </Text>
            {country ? (
              <Text size="xs" typography="helper" color="$mutedSky" numberOfLines={1}>
                {country}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
      </HStack>
    </VStack>
  );
};
