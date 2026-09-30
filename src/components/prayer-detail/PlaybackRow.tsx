import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";

import { DetailPanel } from "@/components/prayer-detail/DetailPanel";
import { HStack } from "@/components/ui/hstack";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { Section } from "@/components/ui/section";
import { SECTION_KIND } from "@/constants/Section";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { PlatformType } from "@/enums/app";
import { useNotificationStore } from "@/stores/notification";

const summaryKey = (athan: boolean, iqama: boolean) => {
  if (athan && iqama) return "prayerDetail.playback.summary.both";
  if (athan) return "prayerDetail.playback.summary.athan";
  if (iqama) return "prayerDetail.playback.summary.iqama";
  return "prayerDetail.playback.summary.off";
};

/** The global full-playback setting under its own header, linked. */
export const PlaybackRow = () => {
  const { t } = useTranslation();
  const athan = useNotificationStore((state) => state.fullAthanPlayback);
  const iqama = useNotificationStore((state) => state.fullIqamaPlayback);

  // Full playback is an Android foreground-service player; iOS has none.
  if (Platform.OS !== PlatformType.ANDROID) return null;

  const destination = BACK_DESTINATION.SETTINGS_ATHAN_PLAYBACK;
  // The scope line says the same to readers, so the chip is drawn only.
  const chip = (
    <HStack
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      paddingHorizontal="$2"
      paddingVertical="$0.5"
      borderRadius="$pill"
      backgroundColor="$accentSoft">
      <Text size="2xs" bold color="$accent">
        {t("prayerDetail.playback.global")}
      </Text>
    </HStack>
  );

  return (
    <Section kind={SECTION_KIND.LABEL} title={t("prayerDetail.sections.playback")} accessory={chip}>
      <DetailPanel>
        <VStack gap="$tight">
          <ListRow
            variant={LIST_ROW_VARIANT.PLAIN}
            title={t("prayerDetail.playback.title")}
            status={t(summaryKey(athan, iqama))}
            hint={t("a11y.prayerDetail.playback.hint", { name: t(destination.title) })}
            onPress={() => router.push(destination.href)}
          />
          <Text size="xs" color="$muted" paddingHorizontal="$1" paddingBottom="$1">
            {t("prayerDetail.playback.scope")}
          </Text>
        </VStack>
      </DetailPanel>
    </Section>
  );
};
