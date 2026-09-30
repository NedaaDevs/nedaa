import { AccessibilityInfo } from "react-native";
import { useTranslation } from "react-i18next";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import type { PrayerId } from "@/constants/Prayer";
import { usePrayerAlertSettings } from "@/hooks/usePrayerAlertSettings";

/** Marks a prayer with its own alert settings and offers to drop them. */
export const AlertsHeader = ({ prayerId }: { prayerId: PrayerId }) => {
  const { t } = useTranslation();
  const { isCustom, reset } = usePrayerAlertSettings(prayerId);

  // A prayer on the defaults has nothing to reset.
  if (!isCustom) return null;

  const resetToDefaults = async () => {
    await reset();
    // The control leaves the screen with the override, so say what happened.
    AccessibilityInfo.announceForAccessibility(t("a11y.prayerDetail.alertsHeader.resetDone"));
  };

  return (
    <HStack alignItems="center" justifyContent="space-between" gap="$3">
      <Text
        size="xs"
        bold
        color="$accent"
        backgroundColor="$accentSoft"
        borderRadius="$pill"
        paddingHorizontal="$2"
        paddingVertical="$0.5"
        numberOfLines={1}
        flexShrink={1}>
        {t("prayerDetail.alertsHeader.custom")}
      </Text>
      <Pressable
        onPress={() => void resetToDefaults()}
        accessibilityRole="button"
        accessibilityLabel={t("prayerDetail.alertsHeader.reset")}
        accessibilityHint={t("a11y.prayerDetail.alertsHeader.resetHint")}
        justifyContent="center"
        paddingHorizontal="$2"
        borderRadius="$control">
        <Text size="sm" color="$accent">
          {t("prayerDetail.alertsHeader.reset")}
        </Text>
      </Pressable>
    </HStack>
  );
};
