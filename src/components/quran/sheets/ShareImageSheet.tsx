import { useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Image as ImageIcon, Type, Share2 } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { MushafVersion, QuranThemeType, ShareCardStyle } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import ReaderBottomSheet from "@/components/quran/sheets/ReaderBottomSheet";
import AyahShareCard from "@/components/quran/AyahShareCard";

interface ShareImageSheetProps {
  surah: number;
  ayah: number;
  version: MushafVersion;
  page: number;
  text: string;
  surahName: string;
  ayahRef: string;
  quranTheme: QuranThemeType;
  // Whether the verse can render as its edition Mushaf image (else text only).
  imageAvailable: boolean;
  onClose: () => void;
}

const ShareImageSheet = ({
  surah,
  ayah,
  version,
  page,
  text,
  surahName,
  ayahRef,
  quranTheme,
  imageAvailable,
  onClose,
}: ShareImageSheetProps) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;

  const storedStyle = useQuranStore((s) => s.shareStyle);
  const setShareStyle = useQuranStore((s) => s.setShareStyle);
  const includeLogo = useQuranStore((s) => s.shareIncludeLogo);
  const setIncludeLogo = useQuranStore((s) => s.setShareIncludeLogo);

  // No edition image for this page → force the text card.
  const style = imageAvailable ? storedStyle : ShareCardStyle.TEXT;

  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const cardWidth = Math.min(width - 64, 360);

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `${surahName} ${ayahRef}`,
        });
      }
    } catch {
      // share cancelled or capture failed — no feedback
    } finally {
      setBusy(false);
    }
  };

  const styleOptions = [
    { value: ShareCardStyle.IMAGE, label: t("quran.share.styleImage"), icon: ImageIcon },
    { value: ShareCardStyle.TEXT, label: t("quran.share.styleText"), icon: Type },
  ];

  return (
    <ReaderBottomSheet onClose={onClose} quranTheme={quranTheme}>
      <YStack gap="$4" alignItems="center">
        <Text fontSize={15} fontWeight="700" color={c.headerColor}>
          {t("quran.share.title")}
        </Text>

        {/* Live preview = the exact capture target (RN View: view-shot needs
            collapsable=false on Android) */}
        <View ref={cardRef} collapsable={false} style={{ backgroundColor: c.background }}>
          <AyahShareCard
            version={version}
            page={page}
            surah={surah}
            ayah={ayah}
            quranTheme={quranTheme}
            style={style}
            includeLogo={includeLogo}
            text={text}
            surahName={surahName}
            ayahRef={ayahRef}
            width={cardWidth}
            imageAvailable={imageAvailable}
          />
        </View>

        {/* Style pills (only when an edition image is available) */}
        {imageAvailable && (
          <XStack gap="$2.5">
            {styleOptions.map(({ value, label, icon: Icon }) => {
              const on = value === style;
              return (
                <XStack
                  key={value}
                  onPress={() => setShareStyle(value)}
                  pressStyle={{ opacity: 0.85 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                  alignItems="center"
                  gap={7}
                  paddingVertical={9}
                  paddingHorizontal={16}
                  borderRadius={22}
                  minHeight={44}
                  borderWidth={1}
                  borderColor={c.frameColor}
                  backgroundColor={on ? c.frameColor : "transparent"}>
                  <Icon size={16} color={on ? c.background : ink} />
                  <Text fontSize={13.5} fontWeight="600" color={on ? c.background : ink}>
                    {label}
                  </Text>
                </XStack>
              );
            })}
          </XStack>
        )}

        {/* Include-logo toggle */}
        <XStack alignItems="center" gap="$3" justifyContent="center">
          <Text fontSize={14} fontWeight="600" color={ink}>
            {t("quran.share.includeLogo")}
          </Text>
          <Switch
            value={includeLogo}
            onValueChange={setIncludeLogo}
            accessibilityLabel={t("quran.share.includeLogo")}
          />
        </XStack>

        {/* Share */}
        <XStack
          onPress={busy ? undefined : onShare}
          pressStyle={{ opacity: 0.85 }}
          accessibilityRole="button"
          accessibilityLabel={t("quran.share.button")}
          accessibilityState={{ disabled: busy }}
          alignSelf="stretch"
          alignItems="center"
          justifyContent="center"
          gap="$2"
          minHeight={50}
          borderRadius={14}
          opacity={busy ? 0.6 : 1}
          backgroundColor={c.frameColor}>
          <Share2 size={18} color={c.background} />
          <Text fontSize={15} fontWeight="700" color={c.background}>
            {busy ? t("quran.share.sharing") : t("quran.share.button")}
          </Text>
        </XStack>
      </YStack>
    </ReaderBottomSheet>
  );
};

export default ShareImageSheet;
