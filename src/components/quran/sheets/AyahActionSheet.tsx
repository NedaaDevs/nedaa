import { useEffect, useState } from "react";
import { Pressable, Share } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import { Copy, Share2, Bookmark, Check } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import {
  BOOKMARK_COLORS,
  BOOKMARK_COLOR_ORDER,
  QURAN_FONT_FAMILY,
  QURAN_THEME_COLORS,
} from "@/constants/Quran";
import { BookmarkColor, QuranTheme } from "@/enums/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { useBookmarkStore } from "@/stores/quranBookmarks";
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

  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const setBookmark = useBookmarkStore((s) => s.setBookmark);
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark);

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

  // This ayah's colour (if any) and the colours already used by other ayahs —
  // each colour is a single mushaf-wide slot.
  const bookmark = bookmarks.find((b) => b.surah === target.surah && b.ayah === target.ayah);
  const usedColors = new Set(bookmarks.map((b) => b.color));

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
  const toggleColor = (color: BookmarkColor) => {
    if (!data) return;
    if (bookmark?.color === color) {
      removeBookmark(target.surah, target.ayah);
    } else {
      setBookmark(target.surah, target.ayah, data.page, color);
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

      {/* Bookmark — tap a free colour to mark this ayah; tap a used one to move it
          here; tap this ayah's own colour to remove it. A dot marks colours in use. */}
      <XStack alignItems="center" gap="$2" paddingTop="$4" paddingBottom="$1">
        <Bookmark
          size={16}
          color={ink}
          fill={bookmark ? BOOKMARK_COLORS[bookmark.color].solid : "transparent"}
        />
        <Text fontSize={13} fontWeight="600" color={ink}>
          {t("quran.action.bookmark")}
        </Text>
      </XStack>
      <XStack justifyContent="space-between" paddingTop="$2">
        {BOOKMARK_COLOR_ORDER.map((color) => {
          const selected = bookmark?.color === color;
          const taken = usedColors.has(color) && !selected;
          const name = t(`quran.bookmark.color.${color}`);
          return (
            <ColorSwatch
              key={color}
              color={color}
              selected={selected}
              taken={taken}
              label={taken ? `${name} — ${t("quran.bookmark.inUse")}` : name}
              ink={ink}
              onPress={() => toggleColor(color)}
            />
          );
        })}
      </XStack>
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

const ColorSwatch = ({
  color,
  selected,
  taken,
  label,
  ink,
  onPress,
}: {
  color: BookmarkColor;
  selected: boolean;
  taken: boolean;
  label: string;
  ink: `#${string}`;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    hitSlop={7}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected }}
    style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
    <YStack
      width={36}
      height={36}
      borderRadius={18}
      borderWidth={selected ? 2.5 : 0}
      borderColor={ink}
      alignItems="center"
      justifyContent="center">
      <YStack
        width={26}
        height={26}
        borderRadius={13}
        backgroundColor={BOOKMARK_COLORS[color].solid}
        alignItems="center"
        justifyContent="center">
        {selected ? (
          <Check size={14} color="#fff" />
        ) : taken ? (
          <YStack width={8} height={8} borderRadius={4} backgroundColor="rgba(255,255,255,0.92)" />
        ) : null}
      </YStack>
    </YStack>
  </Pressable>
);

export default AyahActionSheet;
