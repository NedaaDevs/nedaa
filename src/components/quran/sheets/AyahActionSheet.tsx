import { useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Copy,
  Share2,
  Image as ImageIcon,
  Bookmark,
  Highlighter,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Layers,
  Palette,
  Play,
  FastForward,
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
import {
  AyahSubViewKind,
  BookmarkColor,
  HighlightColor,
  MushafVersion,
  QuranThemeType,
  ReaderViewMode,
} from "@/enums/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { QuranDownload } from "@/services/quran-download";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { SAJDA_AYAHS } from "@/services/guide-content";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useBookmarkStore } from "@/stores/quranBookmarks";
import { useQuranStore } from "@/stores/quran";
import { useRTL } from "@/contexts/RTLContext";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import ReaderBottomSheet from "@/components/quran/sheets/ReaderBottomSheet";
import ShareImageSheet from "@/components/quran/sheets/ShareImageSheet";
import AyahSubView from "@/components/quran/sheets/AyahSubView";
import RibbonGlyph from "@/components/quran/RibbonGlyph";
import AyahImage from "@/components/quran/AyahImage";
import { buildTajweedCards } from "@/components/quran/tajweed-cards";
import { MutashabihatGroup } from "@/types/mutashabihat";

interface AyahActionSheetProps {
  // Fires when a play action starts reader audio; the screen re-shows its chrome
  // so the audio control is reachable.
  onPlayStarted?: () => void;
  // The ayah whose actions are shown; null closes the sheet.
  target: { surah: number; ayah: number } | null;
  quranTheme: QuranThemeType;
  onClose: () => void;
  // Jump the reader to a verse (from the similar-verses sub-view); closes the sheet.
  onGoTo: (surah: number, ayah: number, page: number) => void;
}

const AyahActionSheet = ({
  target,
  quranTheme,
  onClose,
  onGoTo,
  onPlayStarted,
}: AyahActionSheetProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { isRTL } = useRTL();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const version = useQuranStore((s) => s.currentVersion);
  const readerMode = useQuranStore((s) => s.readerMode);
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;
  const [data, setData] = useState<{ text: string; page: number } | null>(null);
  const [done, setDone] = useState<"copy" | "share" | null>(null);
  const [shareImageOpen, setShareImageOpen] = useState(false);
  const [group, setGroup] = useState<MutashabihatGroup | null>(null);
  // Distinct tajweed rules (CPAL index + edition hex) in this ayah; V4 only.
  const [tajweed, setTajweed] = useState<{ index: number; hex: string }[]>([]);
  // The bookmark colour pending a "move it here" confirmation (it's in use elsewhere).
  const [confirm, setConfirm] = useState<BookmarkColor | null>(null);
  // Active sub-view (similar verses / tajweed / sajda) shown over the actions; null = actions.
  const [subView, setSubView] = useState<AyahSubViewKind | null>(null);

  // The sub-view sits on a panel over the actions; dragging its header down moves the
  // panel with the finger and, past a threshold, slides it off to reveal the actions —
  // a native back gesture without a second (cascade-prone) modal.
  // Plain functions/gesture (not useCallback/useMemo): the React Compiler memoizes
  // them, and keeping subOffset out of a hook dependency list avoids the immutability
  // rule that fires when a value passed to a hook is then mutated.
  const subOffset = useSharedValue(0);
  const closeSubView = () => setSubView(null);
  // Reset the slide offset synchronously on open so the panel starts covering (not at
  // a leftover slid-off position from the previous close).
  const openSubView = (kind: AyahSubViewKind) => {
    subOffset.value = 0;
    setSubView(kind);
  };
  const subDrag = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onChange((e) => {
      "worklet";
      subOffset.value = Math.max(0, subOffset.value + e.changeY);
    })
    .onEnd((e) => {
      "worklet";
      if (subOffset.value > 96 || e.velocityY > 700) {
        subOffset.value = withTiming(height, { duration: 180 }, (done) => {
          if (done) scheduleOnRN(closeSubView);
        });
      } else {
        subOffset.value = withSpring(0, { damping: 22, stiffness: 220 });
      }
    });
  const subPanelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: subOffset.value }],
  }));

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
    setGroup(null);
    setTajweed([]);
    setSubView(null);
    let cancelled = false;
    QuranContentDB.getAyah(target.surah, target.ayah).then((d) => {
      if (!cancelled) setData(d);
    });
    QuranContentDB.getMutashabihatGroupForAyah(target.surah, target.ayah).then((g) => {
      if (!cancelled) setGroup(g);
    });
    // Tajweed colours only exist in the V4 edition's bounds.db.
    if (version === MushafVersion.V4) {
      QuranContentDB.getAyahTajweed(version, target.surah, target.ayah).then((t) => {
        if (!cancelled) setTajweed(t);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [target, version]);

  if (!target) return null;

  const ref = formatNumberToLocale(String(target.ayah));
  const surahName = localizedSurahName(target.surah);
  const shareBody = data ? `${data.text}\n${surahName} ${ref}` : "";
  const isSajda = SAJDA_AYAHS.some((s) => s.surah === target.surah && s.ayah === target.ayah);

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

  const RowChevron = isRTL ? ChevronLeft : ChevronRight;

  // Distinct tajweed rules in this ayah (V4 only) — drives the row count/visibility;
  // the rules themselves are shown on the full tajweed page.
  const tajweedCount = buildTajweedCards(tajweed, t).length;

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
    <>
      <ReaderBottomSheet
        onClose={onClose}
        quranTheme={quranTheme}
        scrollable
        name="ayah-action"
        // In a sub-view the panel's own drag-to-go-back owns vertical gestures, so the
        // sheet's swipe-to-close is disabled there.
        enablePanDownToClose={subView === null}>
        {/* Header: surah name + ayah ref */}
        <XStack alignItems="center" gap="$2" paddingBottom="$2">
          <Text fontSize={15} fontWeight="700" color={c.headerColor} flex={1}>
            {surahName}
          </Text>
          <Text fontSize={13} color={c.pageNumberColor}>
            {ref}
          </Text>
        </XStack>

        {/* Body scrolls internally; the pinned header above stays put. */}
        <BottomSheetScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <YStack>
            <YStack paddingBottom="$3" alignItems="center">
              {showImageVerse && data ? (
                <AyahImage
                  version={version}
                  page={data.page}
                  surah={target.surah}
                  ayah={target.ayah}
                  quranTheme={quranTheme}
                  maxWidth={Math.min(width - 56, 440)}
                  fallback={versePreview}
                />
              ) : (
                versePreview
              )}
            </YStack>

            {/* Bookmark — 4 ribbon slots, inline (quick to set) */}
            <YStack borderTopWidth={1} borderTopColor={c.frameColor} paddingTop="$2.5" gap="$2.5">
              <XStack alignItems="center" gap="$2">
                <Bookmark size={15} color={c.pageNumberColor} />
                <Text fontSize={12} fontWeight="700" color={c.pageNumberColor} letterSpacing={0.5}>
                  {t("quran.bookmark.title").toUpperCase()}
                </Text>
              </XStack>
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
            </YStack>

            {/* Highlight — colour chips, inline */}
            <YStack
              borderTopWidth={1}
              borderTopColor={c.frameColor}
              paddingTop="$2.5"
              marginTop="$3"
              gap="$2.5">
              <XStack alignItems="center" gap="$2">
                <Highlighter size={15} color={c.pageNumberColor} />
                <Text fontSize={12} fontWeight="700" color={c.pageNumberColor} letterSpacing={0.5}>
                  {t("quran.highlight.title").toUpperCase()}
                </Text>
              </XStack>
              <HighlightPanel
                chrome={c}
                quranTheme={quranTheme}
                ink={ink}
                sel={highlight?.color ?? null}
                label={highlight ? colorLabel(highlight.color) : null}
                onPick={(color) =>
                  data && toggleHighlight(target.surah, target.ayah, data.page, color)
                }
                onRemove={() => removeHighlight(target.surah, target.ayah)}
                onManage={openManage}
              />
            </YStack>

            {/* Listen — play this verse, or from here to the end of the surah */}
            <YStack borderTopWidth={1} borderTopColor={c.frameColor} marginTop="$3">
              <Pressable
                onPress={() => {
                  quranAudioPlayer.playAyah(target.surah, target.ayah);
                  onPlayStarted?.();
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={t("quran.listen.playAyah")}
                style={{ minHeight: 52, justifyContent: "center" }}>
                <XStack alignItems="center" gap="$3" paddingVertical="$2">
                  <Play size={20} color={c.headerColor} />
                  <Text fontSize={15} fontWeight="600" color={c.headerColor} flex={1}>
                    {t("quran.listen.playAyah")}
                  </Text>
                </XStack>
              </Pressable>
              <Pressable
                onPress={() => {
                  quranAudioPlayer.playFromHere(target.surah, target.ayah);
                  onPlayStarted?.();
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={t("quran.listen.playFromHere")}
                style={{ minHeight: 52, justifyContent: "center" }}>
                <XStack alignItems="center" gap="$3" paddingVertical="$2">
                  <FastForward size={20} color={c.headerColor} />
                  <Text fontSize={15} fontWeight="600" color={c.headerColor} flex={1}>
                    {t("quran.listen.playFromHere")}
                  </Text>
                </XStack>
              </Pressable>
            </YStack>

            {/* Sajda → full page (only on a sajda ayah) */}
            {isSajda && (
              <YStack borderTopWidth={1} borderTopColor={c.frameColor} marginTop="$3">
                <ActionRow
                  symbol="۩"
                  label={t("quran.guide.sajda.about.title")}
                  ink={c.headerColor}
                  chevron={RowChevron}
                  onPress={() => openSubView(AyahSubViewKind.SAJDA)}
                />
              </YStack>
            )}

            {/* Similar verses → full comparison page (only when this ayah is in a group) */}
            {group && group.members.length > 1 && (
              <YStack borderTopWidth={1} borderTopColor={c.frameColor} marginTop="$3">
                <ActionRow
                  icon={Layers}
                  label={`${t("quran.mutashabihat.row")} · ${group.members.length}`}
                  ink={c.headerColor}
                  chevron={RowChevron}
                  onPress={() => openSubView(AyahSubViewKind.MUTASHABIHAT)}
                />
              </YStack>
            )}

            {/* Tajweed → full rule-list page (V4 edition only; rules present in this ayah) */}
            {tajweedCount > 0 && (
              <YStack borderTopWidth={1} borderTopColor={c.frameColor} marginTop="$3">
                <ActionRow
                  icon={Palette}
                  label={`${t("quran.tajweed.row")} · ${formatNumberToLocale(String(tajweedCount))}`}
                  ink={c.headerColor}
                  chevron={RowChevron}
                  onPress={() => openSubView(AyahSubViewKind.TAJWEED)}
                />
              </YStack>
            )}

            {/* Quick utilities */}
            <XStack
              justifyContent="center"
              gap="$7"
              paddingTop="$3"
              marginTop="$3"
              borderTopWidth={1}
              borderTopColor={c.frameColor}>
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
              <UtilButton
                icon={ImageIcon}
                label={t("quran.action.shareImage")}
                onPress={() => setShareImageOpen(true)}
                ink={c.pageNumberColor}
              />
            </XStack>
          </YStack>
        </BottomSheetScrollView>

        {/* Sub-view panel over the actions; drag its header down to slide back. */}
        {subView && (
          <Animated.View
            style={[StyleSheet.absoluteFill, subPanelStyle, { backgroundColor: c.background }]}>
            <AyahSubView
              kind={subView}
              surah={target.surah}
              ayah={target.ayah}
              quranTheme={quranTheme}
              group={group}
              tajweed={tajweed}
              onBack={closeSubView}
              onGoTo={onGoTo}
              dragGesture={subDrag}
            />
          </Animated.View>
        )}
      </ReaderBottomSheet>

      {shareImageOpen && data && (
        <ShareImageSheet
          surah={target.surah}
          ayah={target.ayah}
          version={version}
          page={data.page}
          text={data.text}
          surahName={surahName}
          ayahRef={ref}
          quranTheme={quranTheme}
          imageAvailable={QuranDownload.isPageAvailable(version, data.page)}
          onClose={() => setShareImageOpen(false)}
        />
      )}
    </>
  );
};

// One primary action: leading icon (or Arabic glyph), label, optional state dot,
// and a chevron — tapping opens its full page.
const ActionRow = ({
  icon: Icon,
  symbol,
  label,
  ink,
  dotColor,
  chevron: Chevron,
  onPress,
}: {
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  symbol?: string;
  label: string;
  ink: `#${string}`;
  dotColor?: string;
  chevron: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={{ minHeight: 52, justifyContent: "center" }}>
    <XStack alignItems="center" gap="$3" paddingVertical="$2">
      {Icon ? (
        <Icon size={20} color={ink} />
      ) : (
        <Text
          fontSize={20}
          color={ink}
          style={{ fontFamily: QURAN_TEXT_FONT, width: 20, textAlign: "center" }}>
          {symbol}
        </Text>
      )}
      <Text fontSize={15} fontWeight="600" color={ink} flex={1}>
        {label}
      </Text>
      {dotColor ? (
        <YStack width={12} height={12} borderRadius={6} style={{ backgroundColor: dotColor }} />
      ) : null}
      <Chevron size={18} color={ink} />
    </XStack>
  </Pressable>
);

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

type Paper = (typeof QURAN_THEME_COLORS)[QuranThemeType];

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
  quranTheme: QuranThemeType;
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
  quranTheme: QuranThemeType;
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
