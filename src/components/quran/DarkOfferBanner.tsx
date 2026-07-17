import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { XStack } from "tamagui";
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Moon, X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion } from "@/enums/quran";
import { QuranDownload } from "@/services/quran-download";
import { QuranManifestService } from "@/services/quran-manifest";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";

interface DarkOfferBannerProps {
  version: MushafVersion;
  onDismiss: () => void;
}

// One-time, contextual nudge: shown only while reading a colored edition in
// dark mode without its dark page bundle. Tapping starts the dark download
// (which hides the banner); the X dismisses it for good for this edition.
const DarkOfferBanner = ({ version, onDismiss }: DarkOfferBannerProps) => {
  const { t } = useTranslation();
  const chrome = useQuranChromeColors();
  const reduceMotion = useReducedMotion();
  const [sizeMB, setSizeMB] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    QuranManifestService.getVersionInfo(version).then((info) => {
      if (active && info?.images.dark) setSizeMB(Math.round(info.images.dark.bytes / 1e6));
    });
    return () => {
      active = false;
    };
  }, [version]);

  const sizeLabel = sizeMB == null ? "" : t("quran.download.sizeMB", { size: sizeMB });

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.springify().damping(18).stiffness(200)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(200)}
      style={[
        styles.container,
        { backgroundColor: chrome.cardBackground, borderColor: chrome.cardBorder },
      ]}>
      <Pressable
        style={{ flex: 1 }}
        onPress={() => QuranDownload.startDark(version)}
        accessibilityRole="button"
        accessibilityLabel={t("quran.download.darkOffer", { size: sizeLabel })}>
        <XStack alignItems="center" gap="$2" flex={1}>
          <Moon size={16} color={chrome.accent} />
          <Text fontSize={13} flex={1}>
            {t("quran.download.darkOffer", { size: sizeLabel })}
          </Text>
        </XStack>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}>
        <X size={14} color={chrome.subtleText} />
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
