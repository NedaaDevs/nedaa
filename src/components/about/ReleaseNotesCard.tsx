import { useTranslation } from "react-i18next";

import { Pill } from "@/components/ui/pill";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useWhatsNewSheetStore } from "@/stores/whatsNewSheet";
import { appVersion } from "@/utils/appVersion";

/** The way into the release notes, marked with the installed version. */
export const ReleaseNotesCard = () => {
  const { t } = useTranslation();
  const requestOpen = useWhatsNewSheetStore((s) => s.requestOpen);
  const version = appVersion();
  return (
    <Pressable
      onPress={requestOpen}
      accessibilityRole="button"
      accessibilityLabel={t("a11y.about.release", { version })}
      accessibilityHint={t("a11y.about.releaseHint")}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      padding="$3"
      borderWidth={1}
      borderColor="$accentEdge"
      borderRadius="$card"
      backgroundColor="$accentSoft">
      <VStack flex={1}>
        <Text size="md" bold typography="title" color="$fg">
          {t("settings.about.releaseTitle")}
        </Text>
        <Text size="sm" typography="helper" color="$muted">
          {t("settings.about.releaseSummary")}
        </Text>
      </VStack>
      <Pill>{version}</Pill>
    </Pressable>
  );
};
