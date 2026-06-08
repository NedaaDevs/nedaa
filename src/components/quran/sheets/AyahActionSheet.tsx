import { useEffect, useState } from "react";
import { Pressable, Share, useWindowDimensions } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Copy,
  Share2,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
} from "lucide-react-native";

import { Text } from "@/components/ui/text";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_ORDER,
  BOOKMARK_COLORS,
  BOOKMARK_COLOR_ORDER,
  QURAN_THEME_COLORS,
  QURAN_TEXT_FONT,
  highlightTint,
  bookmarkTint,
} from "@/constants/Quran";
import { BookmarkColor, HighlightColor, QuranTheme, ReaderViewMode } from "@/enums/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { QuranDownload } from "@/services/quran-download";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useBookmarkStore } from "@/stores/quranBookmarks";
import { useQuranStore } from "@/stores/quran";
import { useRTL } from "@/contexts/RTLContext";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import ReaderSheet from "@/components/quran/sheets/ReaderSheet";
import RibbonGlyph from "@/components/quran/RibbonGlyph";
import AyahImage from "@/components/quran/AyahImage";

type Tab = "hl" | "bmk";

interface AyahActionSheetProps {
  // The ayah whose actions are shown; null closes the sheet.
  target: { surah: number; ayah: number } | null;
  quranTheme: QuranTheme;
  onClose: () => void;
}

const AyahActionSheet = ({ target, quranTheme, onClose }: AyahActionSheetProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const version = useQuranStore((s) => s.currentVersion);
  const readerMode = useQuranStore((s) => s.readerMode);
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;
  const [data, setData] = useState<{ text: string; page: number } | null>(null);
  const [done, setDone] = useState<"copy" | "share" | null>(null);
  // Default to the Bookmark tab — bookmarking is the quick "save my place" verb,
  // so it sits one tap away under the thumb.
  const [tab, setTab] = useState<Tab>("bmk");
  // The bookmark colour pending a "move it here" confirmation (it's in use elsewhere).
  const [confirm, setConfirm] = useState<BookmarkColor | null>(null);

  const highlights = useHighlightStore((s) => s.highlights);
  const labels = useHighlightStore((s) => s.labels);
  const toggleHighlight = useHighlightStore((s) => s.toggleHighlight);
  const removeHighlight = useHighlightStore((s) => s.removeHighlight);

  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const setBookmark = useBookmarkStore((s) => s.setBookmark);
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark);

  useEffect(() => {
    if (!target) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDone(null);
    setConfirm(null);
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

  const highlight = highlights.find((h) => h.surah === target.surah && h.ayah === target.ayah);
  const colorLabel = (color: HighlightColor) =>
    labels[color] ?? t(`quran.highlight.color.${color}`);

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
  const openManage = () => {
    onClose();
    router.push("/quran-highlights");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "bmk", label: t("quran.bookmark.title") },
    { id: "hl", label: t("quran.highlight.title") },
  ];

  const versePreview = (
    <Text
      style={{
        fontSize: 21,
        lineHeight: 42,
        textAlign: "center",
        writingDirection: "rtl",
        fontFamily: QURAN_TEXT_FONT,
        color: ink,
      }}>
      {data?.text ?? ""}
    </Text>
  );
  // Colour/image editions: show the verse as it's rendered in the edition (keeps
  // tajweed colour) instead of monochrome DB text; text mode / undownloaded fall back.
  const showImageVerse =
    !!data &&
    readerMode !== ReaderViewMode.TEXT &&
    QuranDownload.isPageAvailable(version, data.page);

  return (
    <ReaderSheet onClose={onClose} quranTheme={quranTheme}>
      {/* Preview */}
      <YStack paddingBottom="$2">
        <XStack alignItems="center" gap="$2" paddingBottom="$2">
          <Text fontSize={14} fontWeight="700" color={c.headerColor}>
            {surahName}
          </Text>
          <Text fontSize={12} color={c.pageNumberColor}>
            {ref}
          </Text>
        </XStack>
        {showImageVerse && data ? (
          <AyahImage
            version={version}
            page={data.page}
            surah={target.surah}
            ayah={target.ayah}
            quranTheme={quranTheme}
            maxWidth={width - 56}
            fallback={versePreview}
          />
        ) : (
          versePreview
        )}
      </YStack>

      {/* Quiet utility strip — demoted secondary actions */}
      <XStack justifyContent="center" gap="$7" paddingVertical="$2.5">
        <UtilButton
          icon={done === "copy" ? Check : Copy}
          label={done === "copy" ? t("quran.action.copied") : t("quran.action.copy")}
          onPress={copy}
          ink={c.pageNumberColor}
        />
        <UtilButton
          icon={done === "share" ? Check : Share2}
          label={done === "share" ? t("quran.action.shared") : t("quran.action.share")}
          onPress={share}
          ink={c.pageNumberColor}
        />
      </XStack>

      {/* Underline tabs (Direction B) */}
      <XStack gap="$5" borderBottomWidth={1} borderBottomColor={c.frameColor} marginTop="$1">
        {tabs.map((tb) => {
          const on = tb.id === tab;
          return (
            <Pressable
              key={tb.id}
              onPress={() => setTab(tb.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tb.label}
              style={{ minHeight: 44, justifyContent: "center" }}>
              <Text
                fontSize={15}
                fontWeight={on ? "700" : "600"}
                color={on ? ink : c.pageNumberColor}
                paddingBottom="$2">
                {tb.label}
              </Text>
              {on && (
                <YStack
                  position="absolute"
                  left={0}
                  right={0}
                  bottom={-1}
                  height={2.5}
                  borderRadius={2}
                  backgroundColor={c.frameColor}
                />
              )}
            </Pressable>
          );
        })}
      </XStack>

      {/* Panel */}
      <YStack paddingTop="$3.5" minHeight={140}>
        {tab === "hl" ? (
          <HighlightPanel
            chrome={c}
            quranTheme={quranTheme}
            ink={ink}
            sel={highlight?.color ?? null}
            label={highlight ? colorLabel(highlight.color) : null}
            onPick={(color) => data && toggleHighlight(target.surah, target.ayah, data.page, color)}
            onRemove={() => removeHighlight(target.surah, target.ayah)}
            onManage={openManage}
          />
        ) : (
          <BookmarkPanel
            chrome={c}
            quranTheme={quranTheme}
            ink={ink}
            bookmarks={bookmarks}
            target={target}
            confirm={confirm}
            onPick={(color) => {
              if (!data) return;
              const at = bookmarks.find((b) => b.color === color);
              const here = at && at.surah === target.surah && at.ayah === target.ayah;
              if (here) {
                removeBookmark(target.surah, target.ayah);
              } else if (at) {
                setConfirm(color);
              } else {
                setBookmark(target.surah, target.ayah, data.page, color);
              }
            }}
            onConfirmMove={() => {
              if (data && confirm) setBookmark(target.surah, target.ayah, data.page, confirm);
              setConfirm(null);
            }}
            onCancelMove={() => setConfirm(null)}
          />
        )}
      </YStack>
    </ReaderSheet>
  );
};

const UtilButton = ({
  icon: Icon,
  label,
  onPress,
  ink,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
  ink: `#${string}`;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={{ alignItems: "center", justifyContent: "center", gap: 4, minHeight: 44, minWidth: 56 }}>
    <Icon size={20} color={ink} />
    <Text fontSize={11} fontWeight="600" color={ink}>
      {label}
    </Text>
  </Pressable>
);

type Paper = (typeof QURAN_THEME_COLORS)[QuranTheme];

// ── Highlight panel: 7 colour chips + active-label pill + Manage link ──
const HighlightPanel = ({
  chrome,
  quranTheme,
  ink,
  sel,
  label,
  onPick,
  onRemove,
  onManage,
}: {
  chrome: Paper;
  quranTheme: QuranTheme;
  ink: `#${string}`;
  sel: HighlightColor | null;
  label: string | null;
  onPick: (color: HighlightColor) => void;
  onRemove: () => void;
  onManage: () => void;
}) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  return (
    <YStack>
      <XStack justifyContent="space-between">
        {HIGHLIGHT_COLOR_ORDER.map((color) => (
          <Chip
            key={color}
            color={HIGHLIGHT_COLORS[color].solid}
            on={color === sel}
            ink={ink}
            label={t(`quran.highlight.color.${color}`)}
            onPress={() => onPick(color)}
          />
        ))}
      </XStack>

      <XStack alignItems="center" gap="$2.5" marginTop="$3.5">
        {sel ? (
          <XStack
            alignItems="center"
            gap="$2"
            borderColor={HIGHLIGHT_COLORS[sel].solid}
            borderWidth={1}
            borderRadius={20}
            paddingVertical="$1.5"
            paddingHorizontal="$2.5"
            style={{ backgroundColor: highlightTint(sel, quranTheme) }}>
            <YStack
              width={11}
              height={11}
              borderRadius={6}
              backgroundColor={HIGHLIGHT_COLORS[sel].solid}
            />
            <Text fontSize={13} fontWeight="700" color={ink}>
              {label}
            </Text>
          </XStack>
        ) : (
          <Text fontSize={12.5} color={chrome.pageNumberColor}>
            {t("quran.highlight.tapHint")}
          </Text>
        )}
        <YStack flex={1} />
        {sel && (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={t("quran.highlight.remove")}
            style={{ minHeight: 44, justifyContent: "center" }}>
            <XStack alignItems="center" gap="$1.5">
              <X size={15} color={chrome.pageNumberColor} />
              <Text fontSize={12.5} fontWeight="600" color={chrome.pageNumberColor}>
                {t("quran.highlight.remove")}
              </Text>
            </XStack>
          </Pressable>
        )}
      </XStack>

      <Pressable
        onPress={onManage}
        accessibilityRole="button"
        accessibilityLabel={t("quran.highlight.manage")}
        accessibilityHint={t("quran.highlight.manageHint")}
        style={{ minHeight: 40, justifyContent: "center", marginTop: 6 }}>
        <XStack alignItems="center" gap="$1.5">
          <SlidersHorizontal size={15} color={chrome.frameColor} />
          <Text fontSize={12.5} fontWeight="600" color={chrome.frameColor}>
            {t("quran.highlight.manage")}
          </Text>
          <Chevron size={14} color={chrome.frameColor} />
        </XStack>
      </Pressable>
    </YStack>
  );
};

const Chip = ({
  color,
  on,
  ink,
  label,
  onPress,
}: {
  color: `#${string}`;
  on: boolean;
  ink: `#${string}`;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected: on }}
    style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
    <YStack
      width={34}
      height={34}
      borderRadius={17}
      borderWidth={on ? 2.5 : 0}
      borderColor={ink}
      alignItems="center"
      justifyContent="center">
      <YStack
        width={25}
        height={25}
        borderRadius={13}
        backgroundColor={color}
        alignItems="center"
        justifyContent="center">
        {on ? <Check size={14} color="#fff" /> : null}
      </YStack>
    </YStack>
  </Pressable>
);

// ── Bookmark panel: 4 ribbon slots + graceful move-confirm ──
const BookmarkPanel = ({
  chrome,
  quranTheme,
  ink,
  bookmarks,
  target,
  confirm,
  onPick,
  onConfirmMove,
  onCancelMove,
}: {
  chrome: Paper;
  quranTheme: QuranTheme;
  ink: `#${string}`;
  bookmarks: { surah: number; ayah: number; page: number; color: BookmarkColor }[];
  target: { surah: number; ayah: number };
  confirm: BookmarkColor | null;
  onPick: (color: BookmarkColor) => void;
  onConfirmMove: () => void;
  onCancelMove: () => void;
}) => {
  const { t } = useTranslation();
  const locOf = (color: BookmarkColor) => bookmarks.find((b) => b.color === color);
  const confirmAt = confirm ? locOf(confirm) : undefined;
  return (
    <YStack>
      <XStack justifyContent="space-between">
        {BOOKMARK_COLOR_ORDER.map((color) => {
          const at = locOf(color);
          const free = !at;
          const here = !!at && at.surah === target.surah && at.ayah === target.ayah;
          return (
            <YStack key={color} flex={1} alignItems="center" gap="$2">
              <Pressable
                onPress={() => onPick(color)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected: here }}
                accessibilityLabel={
                  free
                    ? t("quran.bookmark.freeRibbon")
                    : t("quran.bookmark.ribbonAt", {
                        surah: localizedSurahName(at.surah),
                        ayah: formatNumberToLocale(String(at.ayah)),
                      })
                }
                style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                <YStack padding={4} borderRadius={9} borderWidth={here ? 1.5 : 0} borderColor={ink}>
                  <RibbonGlyph size={32} color={BOOKMARK_COLORS[color].solid} outlined={free} />
                </YStack>
              </Pressable>
              {!free && (
                <Text fontSize={9.5} fontWeight="600" color={ink} textAlign="center">
                  {here
                    ? t("quran.bookmark.here")
                    : `${localizedSurahName(at.surah)} ${formatNumberToLocale(String(at.ayah))}`}
                </Text>
              )}
            </YStack>
          );
        })}
      </XStack>

      {confirm && confirmAt ? (
        <YStack
          marginTop="$3.5"
          borderColor={BOOKMARK_COLORS[confirm].solid}
          borderWidth={1}
          borderRadius={14}
          padding="$3"
          style={{ backgroundColor: bookmarkTint(confirm, quranTheme) }}>
          <Text fontSize={12.5} fontWeight="600" color={ink} marginBottom="$3" lineHeight={18}>
            {t("quran.bookmark.moveConfirm", {
              surah: localizedSurahName(confirmAt.surah),
              ayah: formatNumberToLocale(String(confirmAt.ayah)),
            })}
          </Text>
          <XStack gap="$2.5">
            <Pressable onPress={onConfirmMove} accessibilityRole="button" style={{ flex: 1 }}>
              <YStack
                backgroundColor={BOOKMARK_COLORS[confirm].solid}
                borderRadius={11}
                minHeight={44}
                alignItems="center"
                justifyContent="center">
                <Text fontSize={13.5} fontWeight="700" color="#fff">
                  {t("quran.bookmark.moveHere")}
                </Text>
              </YStack>
            </Pressable>
            <Pressable
              onPress={onCancelMove}
              accessibilityRole="button"
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 18 }}>
              <Text fontSize={13.5} fontWeight="600" color={chrome.pageNumberColor}>
                {t("common.cancel")}
              </Text>
            </Pressable>
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  );
};

export default AyahActionSheet;
