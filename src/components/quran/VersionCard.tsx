import { useEffect, useState } from "react";
import { Alert, Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Check, Eye, Loader, Trash2 } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, DownloadStatus, DownloadPhase } from "@/enums/quran";
import { isColoredVersion } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { useQuranChromeColors, type QuranChromeColors } from "@/hooks/useQuranChromeColors";
import { QuranDownload } from "@/services/quran-download";
import { QuranManifestService, type QuranPreviewImage } from "@/services/quran-manifest";
import MushafThumbnail from "@/components/quran/MushafThumbnail";
import MushafPreviewModal from "@/components/quran/MushafPreviewModal";
import type { QuranManifestVersion } from "@/types/quran";

interface VersionCardProps {
  version: QuranManifestVersion;
  selected: boolean;
  onSelect: (version: QuranManifestVersion) => void;
  // V4 only: whether the download should include the dark-page bundle.
  v4Dark: boolean;
  setV4Dark: (dark: boolean) => void;
}

const VersionCard = ({ version, selected, onSelect, v4Dark, setV4Dark }: VersionCardProps) => {
  const { t } = useTranslation();
  const chrome = useQuranChromeColors();
  const versionId = version.id as MushafVersion;
  const state = useQuranStore((s) => s.versionDownloads[versionId]);
  const [showPreview, setShowPreview] = useState(false);

  const status = state?.status ?? DownloadStatus.IDLE;
  const isComplete = status === DownloadStatus.COMPLETE;
  const isDownloading = status === DownloadStatus.DOWNLOADING || status === DownloadStatus.PAUSED;
  const percent = state?.progress?.percent ?? 0;

  const colored = isColoredVersion(versionId);
  const [previews, setPreviews] = useState<QuranPreviewImage[]>([]);
  useEffect(() => {
    let alive = true;
    QuranManifestService.getPreviews(version).then((p) => {
      if (alive) setPreviews(p);
    });
    return () => {
      alive = false;
    };
  }, [version]);
  const versionLabel = t(`quran.version.${versionId}`);

  const totalMB = Math.round(QuranManifestService.getTotalSizeBytes(version) / 1e6);
  const lightMB = Math.round(QuranManifestService.getImagesSizeBytes(version) / 1e6);

  // Optional dark-theme images (V4), managed independently of the light edition.
  const hasDark = !!version.images.dark;
  const darkSizeMB = Math.round(QuranManifestService.getImagesSizeBytes(version, true) / 1e6);
  const darkStatus = state?.dark?.status ?? DownloadStatus.IDLE;
  const darkComplete = darkStatus === DownloadStatus.COMPLETE;
  const darkDownloading =
    darkStatus === DownloadStatus.DOWNLOADING || darkStatus === DownloadStatus.PAUSED;
  const darkError = darkStatus === DownloadStatus.ERROR;
  const darkPercent = state?.dark?.progress?.percent ?? 0;

  // Downloading has byte progress shown as a percentage; extract and finalize
  // have none, so they show the phase name.
  const progressLabel = (phase: DownloadPhase | undefined, pct: number) =>
    phase === DownloadPhase.EXTRACTING
      ? t("quran.download.phaseExtracting")
      : phase === DownloadPhase.FINALIZING
        ? t("quran.download.phaseFinalizing")
        : `${pct}%`;

  const confirmDeleteVersion = () => {
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

  const showV4Segment = hasDark && selected && !isComplete && !isDownloading;
  const showDarkRow = hasDark && (isComplete || !!state?.dark);

  return (
    <>
      <Pressable
        onPress={() => onSelect(version)}
        disabled={isDownloading}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled: isDownloading }}
        accessibilityLabel={t("a11y.quran.versionCard", {
          name: versionLabel,
          size: totalMB,
          year: version.yearGregorian,
        })}
        style={{
          borderWidth: 2,
          borderColor: selected ? chrome.accent : chrome.cardBorder,
          borderRadius: 18,
          backgroundColor: chrome.cardBackground,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}>
        <XStack padding={16} gap={14}>
          {previews.length > 0 && (
            <MushafThumbnail preview={previews[0]} version={versionId} width={54} radius={9} />
          )}

          <YStack flex={1} gap="$1.5">
            <XStack alignItems="flex-start" gap="$2">
              <YStack flex={1} gap="$1">
                <XStack alignItems="center" gap="$2">
                  <Text fontSize={17} fontWeight="700">
                    {versionLabel}
                  </Text>
                  {/* Dev-only: prod filters unpublished versions out before here. */}
                  {!version.published && (
                    <XStack
                      paddingHorizontal="$1.5"
                      paddingVertical="$0.5"
                      borderRadius="$2"
                      backgroundColor={chrome.cardBorder}>
                      <Text fontSize={10} fontWeight="700" color={chrome.subtleText}>
                        Unpublished
                      </Text>
                    </XStack>
                  )}
                </XStack>
                <Text color={chrome.subtleText} fontSize={12} fontWeight="500">
                  {version.yearHijri} AH · {version.yearGregorian}
                </Text>
              </YStack>
              {isComplete ? (
                <Check size={20} color={chrome.accent} />
              ) : (
                <Radio on={selected} accent={chrome.accent} border={chrome.cardBorder} />
              )}
            </XStack>

            <Text color={chrome.subtleText} fontSize={12.5} lineHeight={17}>
              {t(`quran.versionBlurb.${versionId}`)}
            </Text>

            <XStack alignItems="center" gap="$2.5" flexWrap="wrap">
              <Text color={chrome.subtleText} fontSize={12} fontWeight="600">
                {t("quran.download.sizeMB", { size: totalMB })}
              </Text>
              {colored && (
                <XStack alignItems="center" gap="$1.5">
                  <XStack gap={2}>
                    {(["#B91C1C", "#15803D", "#1C5D7D"] as const).map((c) => (
                      <YStack key={c} width={7} height={7} borderRadius={99} backgroundColor={c} />
                    ))}
                  </XStack>
                  <Text color={chrome.accent} fontSize={11.5} fontWeight="600">
                    {t("quran.version.tajweed")}
                  </Text>
                </XStack>
              )}
              {previews.length > 0 && (
                <Pressable
                  onPress={() => setShowPreview(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("quran.preview.show")}
                  accessibilityHint={t("quran.preview.hint")}
                  hitSlop={8}
                  style={{
                    marginStart: "auto",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}>
                  <Eye size={14} color={chrome.accent} />
                  <Text color={chrome.accent} fontSize={12} fontWeight="600">
                    {t("quran.preview.show")}
                  </Text>
                </Pressable>
              )}
            </XStack>
          </YStack>
        </XStack>

        {/* Inline progress while this version downloads */}
        {isDownloading && (
          <XStack
            alignItems="center"
            gap="$1.5"
            paddingHorizontal={16}
            paddingBottom={14}
            marginTop={-6}>
            <Loader size={14} color={chrome.subtleText} />
            <Text color={chrome.subtleText} fontSize={13} fontWeight="600">
              {progressLabel(state?.progress?.phase, percent)}
            </Text>
          </XStack>
        )}

        {/* V4 light/dark choice, shown when V4 is selected for download */}
        {showV4Segment && (
          <YStack
            paddingHorizontal={16}
            paddingBottom={14}
            gap="$2"
            borderTopWidth={1}
            borderTopColor={chrome.cardBorder}
            paddingTop="$2.5">
            <Text color={chrome.subtleText} fontSize={11.5} fontWeight="600">
              {t("quran.settings.darkMode")}
            </Text>
            <XStack gap="$2">
              <SegButton
                label={t("quran.download.justLight")}
                sub={t("quran.download.sizeMB", { size: lightMB })}
                active={!v4Dark}
                onPress={() => setV4Dark(false)}
                chrome={chrome}
              />
              <SegButton
                label={t("quran.download.lightAndDark")}
                sub={t("quran.download.sizeMB", {
                  size: lightMB + darkSizeMB,
                })}
                active={v4Dark}
                onPress={() => setV4Dark(true)}
                chrome={chrome}
              />
            </XStack>
          </YStack>
        )}

        {/* Installed: independent dark-bundle management row */}
        {showDarkRow && (
          <XStack
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal={16}
            paddingBottom={14}
            paddingTop="$2"
            borderTopWidth={1}
            borderTopColor={chrome.cardBorder}>
            <Text color={chrome.subtleText} fontSize={13}>
              {t("quran.settings.darkMode")} · {t("quran.download.sizeMB", { size: darkSizeMB })}
            </Text>
            {darkComplete ? (
              <Pressable
                onPress={confirmDeleteDark}
                accessibilityRole="button"
                accessibilityLabel={t("quran.settings.deleteVersion", {
                  name: t("quran.settings.darkMode"),
                })}
                hitSlop={8}>
                <Trash2 size={18} color={chrome.subtleText} />
              </Pressable>
            ) : darkDownloading ? (
              <XStack alignItems="center" gap="$1.5">
                <Loader size={14} color={chrome.subtleText} />
                <Text color={chrome.subtleText} fontSize={13} fontWeight="600">
                  {progressLabel(state?.dark?.progress?.phase, darkPercent)}
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

        {/* Installed badge + delete */}
        {isComplete && (
          <XStack
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal={16}
            paddingBottom={14}>
            <Text color={chrome.accent} fontSize={12} fontWeight="600">
              {t("quran.onboarding.downloaded")}
            </Text>
            <Pressable
              onPress={confirmDeleteVersion}
              accessibilityRole="button"
              accessibilityLabel={t("quran.settings.deleteVersion", { name: versionLabel })}
              hitSlop={8}>
              <XStack alignItems="center" gap="$1.5">
                <Trash2 size={14} color={chrome.subtleText} />
                <Text color={chrome.subtleText} fontWeight="600" fontSize={13}>
                  {t("common.delete")}
                </Text>
              </XStack>
            </Pressable>
          </XStack>
        )}
      </Pressable>

      <MushafPreviewModal
        version={version}
        visible={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
};

const Radio = ({
  on,
  accent,
  border,
}: {
  on: boolean;
  accent: `#${string}`;
  border: `#${string}`;
}) => (
  <YStack
    width={22}
    height={22}
    borderRadius={99}
    borderWidth={2}
    borderColor={on ? accent : border}
    backgroundColor={on ? accent : "transparent"}
    alignItems="center"
    justifyContent="center">
    {on && <Check size={12} color="#fff" />}
  </YStack>
);

const SegButton = ({
  label,
  sub,
  active,
  onPress,
  chrome,
}: {
  label: string;
  sub: string;
  active: boolean;
  onPress: () => void;
  chrome: QuranChromeColors;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ selected: active }}
    style={{ flex: 1 }}>
    <YStack
      alignItems="center"
      gap={2}
      paddingVertical="$2"
      borderRadius={10}
      borderWidth={1.5}
      borderColor={active ? chrome.accent : chrome.cardBorder}
      backgroundColor={active ? chrome.background : "transparent"}>
      <Text fontSize={12.5} fontWeight="600" color={active ? chrome.accent : chrome.subtleText}>
        {label}
      </Text>
      <Text fontSize={10.5} fontWeight="500" color={chrome.subtleText}>
        {sub}
      </Text>
    </YStack>
  </Pressable>
);

export default VersionCard;
