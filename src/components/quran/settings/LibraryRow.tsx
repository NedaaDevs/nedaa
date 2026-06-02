import { useState } from "react";
import { Pressable } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Check, Loader, Moon, Trash2 } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, DownloadStatus } from "@/enums/quran";
import { isColoredVersion } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { useQuranChromeColors, type QuranChromeColors } from "@/hooks/useQuranChromeColors";
import { QuranDownload } from "@/services/quran-download";
import type { VersionDownloadState } from "@/types/quran";

interface LibraryRowProps {
  version: MushafVersion;
  state: VersionDownloadState;
  onClose: () => void;
}

const LibraryRow = ({ version, state, onClose }: LibraryRowProps) => {
  const { t } = useTranslation();
  const chrome = useQuranChromeColors();
  const currentVersion = useQuranStore((s) => s.currentVersion);
  const [confirming, setConfirming] = useState(false);

  const name = t(`quran.version.${version}`);
  const isActive = version === currentVersion;
  const isComplete = state.status === DownloadStatus.COMPLETE;
  const isDownloading =
    state.status === DownloadStatus.DOWNLOADING || state.status === DownloadStatus.PAUSED;
  const isError = state.status === DownloadStatus.ERROR;
  const percent = state.progress?.percent ?? 0;

  return (
    <YStack gap="$1.5">
      <Pressable
        onPress={() => {
          if (isComplete) {
            useQuranStore.getState().setCurrentVersion(version);
            onClose();
          } else if (isError) {
            QuranDownload.start(version);
          }
        }}
        accessibilityRole={isComplete ? "radio" : "button"}
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={name}>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingVertical="$2.5"
          paddingHorizontal="$3"
          borderRadius={12}
          backgroundColor={isActive ? chrome.cardBackground : "transparent"}>
          <XStack alignItems="center" gap="$2" flex={1}>
            {isActive && isComplete && <Check size={18} color={chrome.accent} />}
            <Text fontSize={15} fontWeight={isActive ? "700" : "500"}>
              {name}
            </Text>
            {isDownloading && <Loader size={14} color={chrome.subtleText} />}
          </XStack>

          {isDownloading ? (
            <Text fontSize={13} color={chrome.subtleText} fontWeight="600">
              {percent}%
            </Text>
          ) : isError ? (
            <Text fontSize={13} color={chrome.accentWarning} fontWeight="600">
              {t("quran.download.retry")}
            </Text>
          ) : isComplete && !confirming ? (
            <Pressable
              onPress={() => setConfirming(true)}
              accessibilityRole="button"
              accessibilityLabel={t("quran.settings.deleteVersion", { name })}
              hitSlop={8}>
              <Trash2 size={16} color={chrome.subtleText} />
            </Pressable>
          ) : null}
        </XStack>
      </Pressable>

      {confirming && (
        <XStack alignItems="center" gap="$2" paddingHorizontal="$3" paddingBottom="$2">
          <Text fontSize={13} color={chrome.subtleText} flex={1}>
            {t("quran.settings.deleteMessage", { name })}
          </Text>
          <Pressable
            onPress={() => setConfirming(false)}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            hitSlop={8}>
            <Text fontSize={13} fontWeight="600" color={chrome.subtleText}>
              {t("common.cancel")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              QuranDownload.deleteVersion(version);
              setConfirming(false);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("common.delete")}
            hitSlop={8}>
            <Text fontSize={13} fontWeight="700" color={chrome.accentWarning}>
              {t("common.delete")}
            </Text>
          </Pressable>
        </XStack>
      )}

      {isDownloading && (
        <View
          height={3}
          marginHorizontal={12}
          backgroundColor={chrome.progressTrack}
          borderRadius={2}
          overflow="hidden">
          <View height={3} width={`${percent}%`} backgroundColor={chrome.accent} borderRadius={2} />
        </View>
      )}

      {isColoredVersion(version) && (isComplete || state.dark) && (
        <DarkSubRow version={version} state={state} chrome={chrome} />
      )}
    </YStack>
  );
};

const DarkSubRow = ({
  version,
  state,
  chrome,
}: {
  version: MushafVersion;
  state: VersionDownloadState;
  chrome: QuranChromeColors;
}) => {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const status = state.dark?.status ?? DownloadStatus.IDLE;
  const percent = state.dark?.progress?.percent ?? 0;
  const isComplete = status === DownloadStatus.COMPLETE;
  const isDownloading = status === DownloadStatus.DOWNLOADING || status === DownloadStatus.PAUSED;

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$5"
      paddingVertical="$1.5">
      <XStack alignItems="center" gap="$2">
        <Moon size={14} color={chrome.subtleText} />
        <Text fontSize={13} color={chrome.subtleText}>
          {t("quran.settings.darkMode")}
        </Text>
      </XStack>

      {isDownloading ? (
        <Text fontSize={12} color={chrome.subtleText} fontWeight="600">
          {percent}%
        </Text>
      ) : isComplete ? (
        confirming ? (
          <XStack gap="$2" alignItems="center">
            <Pressable
              onPress={() => setConfirming(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}>
              <Text fontSize={12} color={chrome.subtleText} fontWeight="600">
                {t("common.cancel")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                QuranDownload.deleteDark(version);
                setConfirming(false);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("common.delete")}>
              <Text fontSize={12} color={chrome.accentWarning} fontWeight="700">
                {t("common.delete")}
              </Text>
            </Pressable>
          </XStack>
        ) : (
          <Pressable
            onPress={() => setConfirming(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("quran.settings.deleteVersion", {
              name: t("quran.settings.darkMode"),
            })}>
            <Trash2 size={15} color={chrome.subtleText} />
          </Pressable>
        )
      ) : (
        <Pressable
          onPress={() => QuranDownload.startDark(version)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("quran.onboarding.download")}>
          <Text fontSize={12} color={chrome.accent} fontWeight="700">
            {t("quran.onboarding.download")}
          </Text>
        </Pressable>
      )}
    </XStack>
  );
};

export default LibraryRow;
