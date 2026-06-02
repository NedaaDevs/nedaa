import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Moon, Sun, X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, isColoredVersion } from "@/constants/Quran";
import { QuranManifestService } from "@/services/quran-manifest";
import type { QuranManifestVersion } from "@/types/quran";

interface MushafPreviewModalProps {
  version: QuranManifestVersion;
  visible: boolean;
  onClose: () => void;
}

const HEADER_HEIGHT = 52;

// Full-page preview: swipe the sample pages at full size, rendered like the
// reader (ink tinted onto paper for monochrome editions, full colour for V4).
// V4 can toggle to its dark page set.
const MushafPreviewModal = ({ version, visible, onClose }: MushafPreviewModalProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const versionId = version.id as MushafVersion;
  const colored = isColoredVersion(versionId);
  const hasDark = !!version.darkPreviews?.length;
  const [dark, setDark] = useState(false);
  const [loadedPages, setLoadedPages] = useState<Record<string, boolean>>({});

  const previews = QuranManifestService.getPreviews(version, { dark });
  const paper = QURAN_THEME_COLORS[dark ? QuranTheme.DARK : QuranTheme.SEPIA];
  const headerColor = paper.headerColor as `#${string}`;

  // Toggling light/dark swaps to a different page set; clear the loaded flags in
  // the handler so each new page shows its loader until it has decoded.
  const toggleDark = () => {
    setDark((d) => !d);
    setLoadedPages({});
  };

  const availableHeight = height - insets.top - insets.bottom - HEADER_HEIGHT - 24;

  // Warm both the light and dark page sets the moment the viewer opens, so the
  // light/dark toggle swaps instantly instead of fetching the other set on tap.
  useEffect(() => {
    if (!visible) return;
    const urls = [
      ...QuranManifestService.getPreviews(version),
      ...QuranManifestService.getPreviews(version, { dark: true }),
    ].map((p) => p.url);
    urls.forEach((u) => {
      void Image.prefetch(u);
    });
  }, [visible, version]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <YStack flex={1} style={{ backgroundColor: paper.background, paddingTop: insets.top }}>
        <XStack height={HEADER_HEIGHT} alignItems="center" paddingHorizontal={16} gap="$2">
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}>
            <X size={24} color={paper.headerColor} />
          </Pressable>
          <Text flex={1} fontSize={16} fontWeight="700" color={headerColor} numberOfLines={1}>
            {t(`quran.version.${versionId}`)}
          </Text>
          {hasDark && (
            <Pressable
              onPress={toggleDark}
              hitSlop={10}
              accessibilityRole="switch"
              accessibilityState={{ checked: dark }}
              accessibilityLabel={t("quran.settings.darkMode")}>
              {dark ? (
                <Sun size={22} color={paper.headerColor} />
              ) : (
                <Moon size={22} color={paper.headerColor} />
              )}
            </Pressable>
          )}
        </XStack>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: "center" }}>
          {previews.map((p) => {
            const aspect = p.height / p.width;
            const pageWidth = Math.min(width - 32, availableHeight / aspect);
            const pageHeight = Math.round(pageWidth * aspect);
            const loaded = loadedPages[p.url];
            return (
              <View
                key={p.page}
                style={{
                  width,
                  height: availableHeight,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                <View
                  style={{
                    width: pageWidth,
                    height: pageHeight,
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                  <Image
                    key={p.url}
                    source={{ uri: p.url }}
                    onLoad={() => setLoadedPages((s) => ({ ...s, [p.url]: true }))}
                    style={{
                      width: pageWidth,
                      height: pageHeight,
                      tintColor: colored ? undefined : paper.textTint,
                      opacity: loaded ? 1 : 0,
                    }}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                  {!loaded && (
                    <ActivityIndicator style={{ position: "absolute" }} color={headerColor} />
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </YStack>
    </Modal>
  );
};

export default MushafPreviewModal;
