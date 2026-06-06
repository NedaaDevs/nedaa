import { useEffect, useState } from "react";
import { Pressable, Share } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import { Copy, Share2, Bookmark, Check } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { QURAN_FONT_FAMILY, QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranTheme } from "@/enums/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import ReaderSheet from "@/components/quran/sheets/ReaderSheet";

interface AyahActionSheetProps {
  // The ayah whose actions are shown; null closes the sheet.
  target: { surah: number; ayah: number } | null;
  quranTheme: QuranTheme;
  onClose: () => void;
}

const AyahActionSheet = ({ target, quranTheme, onClose }: AyahActionSheetProps) => {
  const { t } = useTranslation();
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;
  const [data, setData] = useState<{ text: string; page: number } | null>(null);
  // Brief success feedback on a button after copy/share; the sheet stays open.
  const [done, setDone] = useState<"copy" | "share" | null>(null);

  useEffect(() => {
    if (!target) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDone(null);
    let cancelled = false;
    QuranContentDB.getAyah(target.surah, target.ayah).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) return null;

  const ref = formatNumberToLocale(String(target.ayah));
  const surahName = localizedSurahName(target.surah);
  const shareBody = data ? `${data.text}\n${surahName} ${ref}` : "";

  const flash = (which: "copy" | "share") => {
    setDone(which);
    setTimeout(() => setDone(null), 1600);
  };
  const copy = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(shareBody);
    flash("copy");
  };
  const share = async () => {
    if (!data) return;
    try {
      const res = await Share.share({ message: shareBody });
      if (res.action === Share.sharedAction) flash("share");
    } catch {
      // share cancelled / failed — no feedback
    }
  };

  return (
    <ReaderSheet onClose={onClose} quranTheme={quranTheme}>
      {/* Ayah preview */}
      <YStack paddingBottom="$3">
        <XStack alignItems="center" gap="$2" paddingBottom="$2">
          <Text fontSize={14} fontWeight="700" color={c.headerColor}>
            {surahName}
          </Text>
          <Text fontSize={12} color={c.pageNumberColor}>
            {ref}
          </Text>
        </XStack>
        <Text
          style={{
            fontSize: 22,
            lineHeight: 44,
            textAlign: "center",
            writingDirection: "rtl",
            fontFamily: QURAN_FONT_FAMILY,
            color: ink,
          }}>
          {data?.text ?? ""}
        </Text>
      </YStack>

      {/* Live actions */}
      <XStack gap="$2.5" paddingTop="$2">
        <ActionButton
          icon={done === "copy" ? Check : Copy}
          label={done === "copy" ? t("quran.action.copied") : t("quran.action.copy")}
          onPress={copy}
          ink={ink}
          border={c.frameColor}
        />
        <ActionButton
          icon={done === "share" ? Check : Share2}
          label={done === "share" ? t("quran.action.shared") : t("quran.action.share")}
          onPress={share}
          ink={ink}
          border={c.frameColor}
        />
      </XStack>

      {/* Reserved — wired with bookmarks (Step 2). */}
      <Pressable
        disabled
        accessibilityRole="button"
        accessibilityLabel={t("quran.action.bookmark")}
        style={{
          marginTop: 14,
          paddingVertical: 14,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: c.frameColor,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: 0.45,
        }}>
        <Bookmark size={18} color={ink} />
        <Text fontSize={14} fontWeight="600" color={ink}>
          {t("quran.action.bookmark")}
        </Text>
      </Pressable>
    </ReaderSheet>
  );
};

const ActionButton = ({
  icon: Icon,
  label,
  onPress,
  ink,
  border,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
  ink: `#${string}`;
  border: `#${string}`;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={{ flex: 1 }}>
    <YStack
      alignItems="center"
      gap="$2"
      paddingVertical="$3.5"
      borderRadius={16}
      borderWidth={1.5}
      borderColor={border}>
      <Icon size={22} color={ink} />
      <Text fontSize={12} fontWeight="600" color={ink}>
        {label}
      </Text>
    </YStack>
  </Pressable>
);

export default AyahActionSheet;
