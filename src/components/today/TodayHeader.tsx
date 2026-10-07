import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { usePlace } from "@/hooks/usePlace";
import { useTodayDates } from "@/hooks/useTodayDates";

export const TODAY_HEADER_PART = {
  DATE_ROW: "today-date-row",
  DATES: "today-dates",
  PLACE: "today-place",
} as const;

/** Today's top: the brand, then the dates, with the place beside or below them. */
export const TodayHeader = () => {
  const { t } = useTranslation();
  const { hijri, gregorian } = useTodayDates();
  const { city, country } = usePlace();

  return (
    <VStack gap="$3.5">
      <SkyOccluder style={styles.hug}>
        <Text size="md" bold color="$fg">
          {t("brand.name")}
        </Text>
      </SkyOccluder>
      {/* Neither side shrinks: when both cannot fit, the place wraps under. */}
      <HStack
        testID={TODAY_HEADER_PART.DATE_ROW}
        flexWrap="wrap"
        justifyContent="space-between"
        alignItems="flex-end"
        gap="$3">
        <SkyOccluder testID={TODAY_HEADER_PART.DATES} style={styles.whole}>
          <VStack gap="$1">
            <Text accessibilityRole="header" size="4xl" bold typography="title" color="$fg">
              {hijri}
            </Text>
            <Text size="md" typography="helper" color="$mutedSky">
              {gregorian}
            </Text>
          </VStack>
        </SkyOccluder>
        {city ? (
          <SkyOccluder testID={TODAY_HEADER_PART.PLACE} style={styles.whole}>
            {/* City and country start together, beside the dates or under them. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("a11y.location.currentCity", { city })}
              accessibilityHint={t("a11y.today.locationHint")}
              onPress={() => router.push(BACK_DESTINATION.SETTINGS_LOCATION.href)}
              alignItems="flex-start"
              justifyContent="flex-end">
              <Text size="md" bold typography="helper" color="$fg" numberOfLines={1}>
                {city}
              </Text>
              {country ? (
                <Text size="sm" typography="helper" color="$mutedSky" numberOfLines={1}>
                  {country}
                </Text>
              ) : null}
            </Pressable>
          </SkyOccluder>
        ) : null}
      </HStack>
    </VStack>
  );
};

const styles = StyleSheet.create({
  hug: { alignSelf: "flex-start" },
  whole: { flexShrink: 0 },
});
