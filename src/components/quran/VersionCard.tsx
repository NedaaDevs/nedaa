import { Alert, Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Check, Loader, Trash2 } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, DownloadStatus } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
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

  // Optional dark-theme bundle (V4), managed independently of the light bundle.
  const hasDark = !!version.darkBundle;
  const darkSizeMB = version.darkBundle ? Math.round(version.darkBundle.sizeMB) : 0;
  const darkStatus = state?.dark?.status ?? DownloadStatus.IDLE;
  const darkComplete = darkStatus === DownloadStatus.COMPLETE;
  const darkDownloading =
    darkStatus === DownloadStatus.DOWNLOADING || darkStatus === DownloadStatus.PAUSED;
  const darkError = darkStatus === DownloadStatus.ERROR;
  const darkPercent = state?.dark?.progress?.percent ?? 0;

  const chrome = useQuranChromeColors();
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

  // Versions with a dark bundle ask, at download time, whether to fetch dark too.
  const promptDarkAtDownload = () => {
    Alert.alert(
      t("quran.download.darkPromptTitle"),
      t("quran.download.darkPromptMessage", { size: darkSizeMB }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("quran.download.justLight"), onPress: () => onDownload(version) },
        {
          text: t("quran.download.lightAndDark"),
          onPress: () => {
            onDownload(version);
            QuranDownload.startDark(versionId);
          },
        },
      ]
    );
  };

  const confirmDeleteDark = () => {
    Alert.alert(
      t("quran.settings.deleteTitle"),
      t("quran.settings.deleteMessage", { name: t("quran.settings.darkMode") }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => QuranDownload.deleteDark(versionId),
        },
      ]
    );
  };

  // Card-level press: download when not yet installed (or retry on error);
  // a downloaded version is read by selecting it; a downloading one is inert.
  // Versions with a dark bundle prompt for the dark add-on before downloading.
  const handleCardPress = () => {
    if (disabled || isDownloading) return;
    if (!isComplete && hasDark) {
      promptDarkAtDownload();
      return;
    }
    onDownload(version);
  };

  const a11yLabel = t("a11y.quran.versionCard", {
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
        borderColor: chrome.cardBorder,
        borderRadius: 16,
        padding: 16,
        backgroundColor: chrome.cardBackground,
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
        </XStack>

        <Text color={chrome.subtleText} fontSize={13}>
          {version.yearHijri} AH · {version.yearGregorian}
        </Text>

        <XStack justifyContent="space-between" alignItems="center">
          <Text color={chrome.subtleText} fontSize={12}>
            {version.totalSizeMB} MB
          </Text>

          {/* Action area reflects the version's download status */}
          {isComplete ? (
            <XStack alignItems="center" gap="$3">
              <XStack alignItems="center" gap="$1">
                <Check size={16} color={chrome.accent} />
                <Text color={chrome.accent} fontSize={12} fontWeight="600">
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
                  borderColor={chrome.cardBorder}>
                  <Trash2 size={14} color={chrome.subtleText} />
                  <Text color={chrome.subtleText} fontWeight="600" fontSize={13}>
                    {t("common.delete")}
                  </Text>
                </XStack>
              </Pressable>
            </XStack>
          ) : isDownloading ? (
            <XStack alignItems="center" gap="$1.5">
              <Loader size={14} color={chrome.subtleText} />
              <Text color={chrome.subtleText} fontSize={13} fontWeight="600">
                {percent}%
              </Text>
            </XStack>
          ) : (
            <YStack
              backgroundColor={chrome.accent}
              paddingHorizontal="$3"
              paddingVertical="$1.5"
              borderRadius="$3">
              <Text color="#fff" fontWeight="600" fontSize={13}>
                {isError ? t("quran.download.retry") : t("quran.onboarding.download")}
              </Text>
            </YStack>
          )}
        </XStack>

        {/* Independent dark-bundle row (V4): download later or delete on its own. */}
        {hasDark && (isComplete || !!state?.dark) && (
          <XStack
            justifyContent="space-between"
            alignItems="center"
            borderTopWidth={1}
            borderTopColor={chrome.cardBorder}
            paddingTop="$2"
            marginTop="$1">
            <Text color={chrome.subtleText} fontSize={13}>
              {t("quran.settings.darkMode")} · {darkSizeMB} MB
            </Text>

            {darkComplete ? (
              <Pressable
                onPress={confirmDeleteDark}
                accessibilityRole="button"
                accessibilityLabel={t("quran.settings.deleteVersion", {
                  name: t("quran.settings.darkMode"),
                })}
                hitSlop={8}>
                <XStack
                  alignItems="center"
                  gap="$1.5"
                  paddingHorizontal="$3"
                  paddingVertical="$1.5"
                  borderRadius="$3"
                  borderWidth={1}
                  borderColor={chrome.cardBorder}>
                  <Trash2 size={14} color={chrome.subtleText} />
                  <Text color={chrome.subtleText} fontWeight="600" fontSize={13}>
                    {t("common.delete")}
                  </Text>
                </XStack>
              </Pressable>
            ) : darkDownloading ? (
              <XStack alignItems="center" gap="$1.5">
                <Loader size={14} color={chrome.subtleText} />
                <Text color={chrome.subtleText} fontSize={13} fontWeight="600">
                  {darkPercent}%
                </Text>
              </XStack>
            ) : (
              <Pressable
                onPress={() => QuranDownload.startDark(versionId)}
                accessibilityRole="button"
                accessibilityLabel={t("quran.settings.darkMode")}
                hitSlop={8}>
                <YStack
                  backgroundColor={chrome.accent}
                  paddingHorizontal="$3"
                  paddingVertical="$1.5"
                  borderRadius="$3">
                  <Text color="#fff" fontWeight="600" fontSize={13}>
                    {darkError ? t("quran.download.retry") : t("quran.onboarding.download")}
                  </Text>
                </YStack>
              </Pressable>
            )}
          </XStack>
        )}
      </YStack>
    </Pressable>
  );
};

export default VersionCard;
