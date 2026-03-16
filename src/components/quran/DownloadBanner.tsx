import { Pressable, View, StyleSheet } from "react-native";
import { XStack } from "tamagui";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { QuranTheme, MushafVersion, DownloadStatus } from "@/enums/quran";
import { QURAN_THEME_COLORS, QURAN_UI_COLORS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";

interface DownloadBannerProps {
  quranTheme: QuranTheme;
  onDismiss: () => void;
}

const VERSION_LABELS: Record<MushafVersion, string> = {
  [MushafVersion.V1]: "V1",
  [MushafVersion.V2]: "V2",
  [MushafVersion.V4]: "V4",
};

const DownloadBanner = ({ quranTheme, onDismiss }: DownloadBannerProps) => {
  const versionDownloads = useQuranStore((s) => s.versionDownloads);
  const selectedVersion = useQuranStore((s) => s.selectedVersion);
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const isDark = quranTheme === QuranTheme.DARK;

  // Find any version that's actively downloading (exclude the selected/primary version
  // since that one shows the full progress screen)
  const downloading = Object.entries(versionDownloads).find(
    ([v, state]) =>
      v !== selectedVersion &&
      (state?.status === DownloadStatus.DOWNLOADING || state?.status === DownloadStatus.PAUSED)
  );

  if (!downloading) return null;

  const [version, state] = downloading;
  const progress = state?.progress;
  const percent =
    progress && progress.totalPages > 0
      ? Math.round((progress.completedPages / progress.totalPages) * 100)
      : 0;

  const bgColor = isDark ? "rgba(30,30,30,0.95)" : "rgba(255,253,247,0.95)";
  const textColor = isDark ? "#E0D6C8" : "#2C1810";
  const borderClr = isDark ? "#333" : QURAN_UI_COLORS.cardBorder;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderColor: borderClr,
        },
      ]}>
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <XStack alignItems="center" gap="$2" flex={1}>
          <Text fontSize={13} color={textColor}>
            {VERSION_LABELS[version as MushafVersion]} — {percent}%
          </Text>
          <View style={{ flex: 1, height: 3, backgroundColor: borderClr, borderRadius: 2 }}>
            <View
              style={{
                height: 3,
                width: `${percent}%`,
                backgroundColor: themeColors.markerColor,
                borderRadius: 2,
              }}
            />
          </View>
        </XStack>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <X size={14} color={isDark ? "#888" : QURAN_UI_COLORS.subtleText} />
        </Pressable>
      </XStack>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
});

export default DownloadBanner;
