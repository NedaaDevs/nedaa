import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { XStack } from "tamagui";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Moon, X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, QURAN_UI_COLORS } from "@/constants/Quran";
import { QuranDownload } from "@/services/quran-download";
import { QuranManifestService } from "@/services/quran-manifest";

interface DarkOfferBannerProps {
  version: MushafVersion;
  quranTheme: QuranTheme;
  onDismiss: () => void;
}

// One-time, contextual nudge: shown only while reading a colored edition in
// dark mode without its dark page bundle. Tapping starts the dark download
// (which hides the banner); the X dismisses it for good for this edition.
const DarkOfferBanner = ({ version, quranTheme, onDismiss }: DarkOfferBannerProps) => {
  const { t } = useTranslation();
  const [sizeMB, setSizeMB] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    QuranManifestService.getVersionInfo(version).then((info) => {
      if (active && info?.darkBundle) setSizeMB(Math.round(info.darkBundle.sizeMB));
    });
    return () => {
      active = false;
    };
  }, [version]);

  const isDark = quranTheme === QuranTheme.DARK;
  const bgColor = isDark ? "rgba(30,30,30,0.95)" : "rgba(255,253,247,0.95)";
  const textColor = isDark ? "#E0D6C8" : "#2C1810";
  const accent = QURAN_THEME_COLORS[quranTheme].markerColor;
  const borderClr = isDark ? "#333" : QURAN_UI_COLORS.cardBorder;

  const sizeLabel = sizeMB == null ? "" : t("quran.download.sizeMB", { size: sizeMB });

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.container, { backgroundColor: bgColor, borderColor: borderClr }]}>
      <Pressable
        style={{ flex: 1 }}
        onPress={() => QuranDownload.startDark(version)}
        accessibilityRole="button"
        accessibilityLabel={t("quran.download.darkOffer", { size: sizeLabel })}>
        <XStack alignItems="center" gap="$2" flex={1}>
          <Moon size={16} color={accent} />
          <Text fontSize={13} color={textColor} flex={1}>
            {t("quran.download.darkOffer", { size: sizeLabel })}
          </Text>
        </XStack>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}>
        <X size={14} color={isDark ? "#888" : QURAN_UI_COLORS.subtleText} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});

export default DarkOfferBanner;
