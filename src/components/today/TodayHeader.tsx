import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, type AccessibilityActionEvent } from "react-native";
import { MapPin } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { usePlace } from "@/hooks/usePlace";
import { useTodayDates } from "@/hooks/useTodayDates";

export const TODAY_HEADER_PART = {
  DATES: "today-dates",
  PLACE: "today-place",
} as const;

const openLocation = () => router.push(BACK_DESTINATION.SETTINGS_LOCATION.href);

/** Today's top: the brand, then the dates with the place as one quiet line. */
export const TodayHeader = () => {
  const { t } = useTranslation();
  const { hijri, gregorian } = useTodayDates();
  const { name: place } = usePlace();
  const placeLabel = place ? t("a11y.location.currentCity", { city: place }) : undefined;

  return (
    <VStack gap="$heroGap">
      <SkyOccluder style={styles.hug}>
        <Text size="md" fontWeight="600" color="$mutedSky">
          {t("brand.name")}
        </Text>
      </SkyOccluder>
      <SkyOccluder style={styles.hug}>
        {/* The whole block takes the tap; a reader meets its parts one by one. */}
        <Pressable
          testID={TODAY_HEADER_PART.DATES}
          accessible={false}
          accessibilityRole="button"
          accessibilityLabel={placeLabel ?? hijri}
          onPress={openLocation}
          flexShrink={0}
          alignItems="flex-start"
          gap="$0.5">
          <Text
            accessibilityRole="header"
            size="headline"
            fontWeight="600"
            typography="title"
            color="$fg">
            {hijri}
          </Text>
          <Text size="md" typography="helper" fontWeight="500" color="$mutedSky">
            {gregorian}
          </Text>
          {place ? (
            <HStack
              testID={TODAY_HEADER_PART.PLACE}
              accessible
              accessibilityRole="button"
              accessibilityLabel={placeLabel}
              accessibilityHint={t("a11y.today.locationHint")}
              accessibilityActions={[{ name: A11Y_ACTION.ACTIVATE }]}
              onAccessibilityAction={({ nativeEvent }: AccessibilityActionEvent) => {
                if (nativeEvent.actionName === A11Y_ACTION.ACTIVATE) openLocation();
              }}
              alignItems="center"
              gap="$1"
              marginTop="$0.5">
              <Icon as={MapPin} size="xs" color="$mutedSky" />
              <Text size="md" typography="helper" fontWeight="500" color="$mutedSky" flexShrink={1}>
                {place}
              </Text>
            </HStack>
          ) : null}
        </Pressable>
      </SkyOccluder>
    </VStack>
  );
};

const styles = StyleSheet.create({
  hug: { alignSelf: "flex-start" },
});
