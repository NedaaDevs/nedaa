import { Alert, Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Check, Loader, Trash2 } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { RECOMMENDED_VERSION, QURAN_UI_COLORS } from "@/constants/Quran";
import { MushafVersion, DownloadStatus } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";
import { QuranDownload } from "@/services/quran-download";
import type { QuranManifestVersion } from "@/types/quran";

interface VersionCardProps {
  version: QuranManifestVersion;
  onDownload: (version: QuranManifestVersion) => void;
  disabled?: boolean;
}

const VersionCard = ({ version, onDownload, disabled }: VersionCardProps) => {
  const { t } = useTranslation();
  const versionId = version.id as MushafVersion;
  const state = useQuranStore((s) => s.versionDownloads[versionId]);

  const status = state?.status ?? DownloadStatus.IDLE;
  const isComplete = status === DownloadStatus.COMPLETE;
  const isDownloading = status === DownloadStatus.DOWNLOADING || status === DownloadStatus.PAUSED;
  const isError = status === DownloadStatus.ERROR;
  const percent = state?.progress?.percent ?? 0;

  const isRecommended = version.id === RECOMMENDED_VERSION;
  const versionLabel = t(`quran.version.${versionId}`);

  const confirmDelete = () => {
    Alert.alert(
      t("quran.settings.deleteTitle"),
      t("quran.settings.deleteMessage", { name: versionLabel }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => QuranDownload.deleteVersion(versionId),
        },
      ]
    );
  };

  // Card-level press: download when not yet installed (or retry on error);
  // a downloaded version is read by selecting it; a downloading one is inert.
  const handleCardPress = () => {
    if (disabled || isDownloading) return;
    onDownload(version);
  };

  const a11yLabel = isRecommended
    ? t("a11y.quran.versionCardRecommended", {
        name: version.name,
        size: version.totalSizeMB,
        year: version.yearGregorian,
      })
    : t("a11y.quran.versionCard", {
        name: version.name,
        size: version.totalSizeMB,
        year: version.yearGregorian,
      });

  return (
    <Pressable
      onPress={handleCardPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: !!disabled || isDownloading }}
      style={{
        borderWidth: 1,
        borderColor: QURAN_UI_COLORS.cardBorder,
        borderRadius: 16,
        padding: 16,
        backgroundColor: QURAN_UI_COLORS.cardBackground,
        opacity: disabled ? 0.5 : 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}>
      <YStack gap="$2">
        <XStack alignItems="center" gap="$2">
          <Text fontWeight="600" fontSize={16}>
            {version.name}
          </Text>
          {isRecommended && (
            <YStack
              backgroundColor={QURAN_UI_COLORS.accent}
              paddingHorizontal="$1.5"
              paddingVertical={2}
              borderRadius={99}>
              <Text color="#fff" fontSize={10} fontWeight="700">
                {t("quran.onboarding.recommended")}
              </Text>
            </YStack>
          )}
        </XStack>

        <Text color={QURAN_UI_COLORS.subtleText} fontSize={13}>
          {version.yearHijri} AH · {version.yearGregorian}
        </Text>

        <XStack justifyContent="space-between" alignItems="center">
          <Text color={QURAN_UI_COLORS.subtleText} fontSize={12}>
            {version.totalSizeMB} MB
          </Text>

          {/* Action area reflects the version's download status */}
          {isComplete ? (
            <XStack alignItems="center" gap="$3">
              <XStack alignItems="center" gap="$1">
                <Check size={16} color={QURAN_UI_COLORS.accent} />
                <Text color={QURAN_UI_COLORS.accent} fontSize={12} fontWeight="600">
                  {t("quran.onboarding.downloaded")}
                </Text>
              </XStack>
              <Pressable
                onPress={confirmDelete}
                accessibilityRole="button"
                accessibilityLabel={t("quran.settings.deleteVersion", { name: versionLabel })}
                hitSlop={8}>
                <XStack
                  alignItems="center"
                  gap="$1.5"
                  paddingHorizontal="$3"
                  paddingVertical="$1.5"
                  borderRadius="$3"
                  borderWidth={1}
                  borderColor={QURAN_UI_COLORS.cardBorder}>
                  <Trash2 size={14} color={QURAN_UI_COLORS.subtleText} />
                  <Text color={QURAN_UI_COLORS.subtleText} fontWeight="600" fontSize={13}>
                    {t("common.delete")}
                  </Text>
                </XStack>
              </Pressable>
            </XStack>
          ) : isDownloading ? (
            <XStack alignItems="center" gap="$1.5">
              <Loader size={14} color={QURAN_UI_COLORS.subtleText} />
              <Text color={QURAN_UI_COLORS.subtleText} fontSize={13} fontWeight="600">
                {percent}%
              </Text>
            </XStack>
          ) : (
            <YStack
              backgroundColor={QURAN_UI_COLORS.accent}
              paddingHorizontal="$3"
              paddingVertical="$1.5"
              borderRadius="$3">
              <Text color="#fff" fontWeight="600" fontSize={13}>
                {isError ? t("quran.download.retry") : t("quran.onboarding.download")}
              </Text>
            </YStack>
          )}
        </XStack>
      </YStack>
    </Pressable>
  );
};

export default VersionCard;
