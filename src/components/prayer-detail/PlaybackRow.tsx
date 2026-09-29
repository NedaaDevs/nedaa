import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { Play } from "lucide-react-native";

import { ListRow } from "@/components/ui/list-row";
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

/** Summarises the global full-playback setting and links to it. */
export const PlaybackRow = () => {
  const { t } = useTranslation();
  const athan = useNotificationStore((state) => state.fullAthanPlayback);
  const iqama = useNotificationStore((state) => state.fullIqamaPlayback);

  // Full playback is an Android foreground-service player; iOS has none.
  if (Platform.OS !== PlatformType.ANDROID) return null;

  const destination = BACK_DESTINATION.SETTINGS_ATHAN_PLAYBACK;
  return (
    <VStack gap="$1.5">
      <ListRow
        icon={Play}
        title={t("prayerDetail.playback.title")}
        status={t(summaryKey(athan, iqama))}
        hint={t("a11y.prayerDetail.playback.hint", { name: t(destination.title) })}
        onPress={() => router.push(destination.href)}
      />
      <Text size="xs" color="$muted" paddingHorizontal="$3">
        {t("prayerDetail.playback.scope")}
      </Text>
    </VStack>
  );
};
