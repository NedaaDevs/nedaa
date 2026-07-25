import { Pressable } from "react-native";
import { XStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, DownloadStatus } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";
import type { QuranChromeColors } from "@/hooks/useQuranChromeColors";
import { Section } from "@/components/quran/settings/SettingsControls";
import LibraryRow from "@/components/quran/settings/LibraryRow";

interface MushafSectionProps {
  chrome: QuranChromeColors;
  onDownloadMore: () => void;
  onClose: () => void;
}

const MushafSection = ({ chrome, onDownloadMore, onClose }: MushafSectionProps) => {
  const { t } = useTranslation();
  const versionDownloads = useQuranStore((s) => s.versionDownloads);

  const installed = Object.entries(versionDownloads)
    .filter(([, s]) => s?.status && s.status !== DownloadStatus.IDLE)
    .map(([v, s]) => ({ version: v as MushafVersion, state: s! }));

  return (
    <Section title={t("quran.settings.library")} chrome={chrome}>
      {installed.map(({ version, state }) => (
        <LibraryRow key={version} version={version} state={state} onClose={onClose} />
      ))}

      <Pressable
        onPress={onDownloadMore}
        accessibilityRole="button"
        accessibilityLabel={t("quran.settings.downloadMore")}>
        <XStack alignItems="center" gap="$2" minHeight={44} paddingHorizontal="$3">
          <Download size={16} color={chrome.accent} />
          <Text fontSize={15} color={chrome.accent} fontWeight="600">
            {t("quran.settings.downloadMore")}
          </Text>
        </XStack>
      </Pressable>
    </Section>
  );
};

export default MushafSection;
