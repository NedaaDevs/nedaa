import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { QURAN_FONT_FAMILY, HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_ORDER } from "@/constants/Quran";
import { QuranContentDB, type AyahSearchHit } from "@/services/quran-content-db";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import { HighlightColor } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useRTL } from "@/contexts/RTLContext";
import type { SurahMeta } from "@/types/quran";

type HighlightHit = {
  surah: number;
  ayah: number;
  page: number;
  color: HighlightColor;
  text: string;
};

const SNAP = 0.32; // release past this fraction → open
const FLING = 700; // px/s that forces a snap regardless of position
const TOP_ZONE = 130; // a downward drag starting within this top band opens search
// overshootClamping kills the spring bounce while keeping the velocity hand-off.
const SPRING = { damping: 26, stiffness: 240, overshootClamping: true } as const;

// Pull-down-to-search: a gesture-driven overlay revealed by dragging down from
// the top of the reader (a top-down shade — search bar first), dismissed by
// swiping up (when the results fit), tapping the backdrop, or the close button.
// Matches verse text (FTS), surah names (transliterated + Arabic), and highlight
// labels/colours; a result jumps to its page and closes.
export type QuranSearchHandle = { open: () => void };

const QuranSearchOverlay = forwardRef<QuranSearchHandle, { children: ReactNode }>(
  ({ children }, ref) => {
    const { t } = useTranslation();
    const { height: screenH } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const chrome = useQuranChromeColors();
    const { isRTL } = useRTL();
    const setCurrentPage = useQuranStore((s) => s.setCurrentPage);
    const BackIcon = isRTL ? ArrowRight : ArrowLeft;

    const [query, setQuery] = useState("");
    const [surahs, setSurahs] = useState<SurahMeta[]>([]);
    const [hits, setHits] = useState<AyahSearchHit[]>([]);
    const [open, setOpen] = useState(false);

    const scrollRef = useRef<ScrollView>(null);

    const progress = useSharedValue(0); // 0 closed → 1 open
    const scrollY = useSharedValue(0); // current results scroll offset
    const dismissing = useSharedValue(false); // this up-drag started at the top
    const startX = useSharedValue(0); // open-drag origin, for zone + axis gating
    const startY = useSharedValue(0);

    // --- open/close state, set from gesture worklets and JS handlers alike ---
    const applyOpen = (v: boolean) => {
      setOpen(v);
      if (!v) setQuery("");
    };
    const close = () => {
      progress.set(withSpring(0, SPRING));
      applyOpen(false);
    };

    useImperativeHandle(
      ref,
      () => ({
        open: () => {
          progress.set(withSpring(1, SPRING));
          setOpen(true);
        },
      }),
      [progress]
    );

    useEffect(() => {
      QuranContentDB.getAllSurahs().then(setSurahs);
    }, []);

    // Debounced verse search; empty query clears (inside the timeout, not the body).
    useEffect(() => {
      const trimmed = query.trim();
      const id = setTimeout(
        () => {
          if (!trimmed) {
            setHits([]);
            return;
          }
          QuranContentDB.searchAyahs(trimmed).then(setHits);
        },
        trimmed ? 200 : 0
      );
      return () => clearTimeout(id);
    }, [query]);

    const q = query.trim().toLowerCase();
    const surahHits = useMemo(() => {
      if (!q) return [];
      return surahs.filter(
        (s) => s.nameTransliterated.toLowerCase().includes(q) || s.nameArabic.includes(query.trim())
      );
    }, [q, query, surahs]);

    const highlights = useHighlightStore((s) => s.highlights);
    const labels = useHighlightStore((s) => s.labels);
    const [hlHits, setHlHits] = useState<HighlightHit[]>([]);

    const matchedColors = useMemo(() => {
      const set = new Set<HighlightColor>();
      if (!q) return set;
      for (const color of HIGHLIGHT_COLOR_ORDER) {
        const label = (labels[color] ?? t(`quran.highlight.color.${color}`)).toLowerCase();
        if (label.includes(q) || color.includes(q)) set.add(color);
      }
      return set;
    }, [q, labels, t]);

    const matchedHighlights = useMemo(
      () => highlights.filter((h) => matchedColors.has(h.color)),
      [highlights, matchedColors]
    );

    useEffect(() => {
      let active = true;
      Promise.all(
        matchedHighlights.map(async (h) => {
          const a = await QuranContentDB.getAyah(h.surah, h.ayah);
          return {
            surah: h.surah,
            ayah: h.ayah,
            page: a?.page ?? 1,
            color: h.color,
            text: a?.text ?? "",
          };
        })
      ).then((res) => {
        if (active) setHlHits(res);
      });
      return () => {
        active = false;
      };
    }, [matchedHighlights]);

    const jumpTo = (page: number) => {
      setCurrentPage(page);
      close();
    };

    // --- gestures ---
    const drag = (changeY: number) => {
      "worklet";
      progress.set(Math.min(1, Math.max(0, progress.get() + changeY / screenH)));
    };
    const release = (toOpen: boolean, velocityY: number) => {
      "worklet";
      progress.set(withSpring(toOpen ? 1 : 0, { ...SPRING, velocity: velocityY }));
      scheduleOnRN(applyOpen, toOpen);
    };

    // Parent gesture over the whole reader. Manual activation means it only claims
    // the touch for a downward drag that starts in the top zone; taps, long-presses,
    // horizontal page-turns and scrolls fall through to the reader/page below.
    const openPan = Gesture.Pan()
      .manualActivation(true)
      .onTouchesDown((e) => {
        const tch = e.allTouches[0];
        startX.set(tch.x);
        startY.set(tch.y);
      })
      .onTouchesMove((e, state) => {
        if (progress.get() >= 1) return;
        const tch = e.allTouches[0];
        const dx = tch.x - startX.get();
        const dy = tch.y - startY.get();
        if (startY.get() <= TOP_ZONE && dy > 10 && dy > Math.abs(dx)) {
          state.activate();
        } else if (startY.get() > TOP_ZONE || dy < -8 || Math.abs(dx) > 16) {
          state.fail();
        }
      })
      .onChange((e) => drag(e.changeY))
      .onEnd((e) => release(progress.get() > SNAP || e.velocityY > FLING, e.velocityY));

    // Up-swipe dismiss. Latches at gesture start: if the list was at the top, this
    // drag dismisses the panel (follows the finger); otherwise it's a normal scroll
    // (the close button / backdrop still dismiss). Latching avoids stutter when the
    // simultaneous scroll moves the offset mid-drag.
    const closePan = Gesture.Pan()
      .activeOffsetY([-12, 9999]) // up-only
      .failOffsetX([-24, 24])
      // eslint-disable-next-line react-hooks/refs -- gesture-handler's documented compose API
      .simultaneousWithExternalGesture(scrollRef)
      .onStart(() => dismissing.set(scrollY.get() <= 0))
      .onChange((e) => {
        if (dismissing.get()) drag(e.changeY);
      })
      .onEnd((e) => {
        if (!dismissing.get()) return;
        const stayOpen = progress.get() > 1 - SNAP && e.velocityY > -FLING;
        release(stayOpen, e.velocityY);
      });

    const panelStyle = useAnimatedStyle(() => ({
      height: interpolate(progress.get(), [0, 1], [0, screenH], Extrapolation.CLAMP),
    }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() * 0.4 }));

    const hasQuery = q.length > 0;
    const empty = hasQuery && hlHits.length === 0 && surahHits.length === 0 && hits.length === 0;

    return (
      <>
        {/* The reader lives inside the open-pan, so the pan is a *parent* gesture
          (arbitrated with the reader's tap + page long-press) rather than an
          overlay on top — taps/long-presses are never blocked. */}
        <GestureDetector gesture={openPan}>
          <View style={{ flex: 1 }}>{children}</View>
        </GestureDetector>

        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[StyleSheet.absoluteFill, { backgroundColor: "#000", zIndex: 30 }, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={close} />
        </Animated.View>

        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden", zIndex: 40 },
            { backgroundColor: chrome.background },
            panelStyle,
          ]}>
          <GestureDetector gesture={closePan}>
            <YStack flex={1} paddingTop={insets.top}>
              <XStack alignItems="center" gap="$2" paddingHorizontal="$3" paddingVertical="$2">
                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.back")}
                  hitSlop={8}
                  style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                  <BackIcon color={chrome.accent} size={24} />
                </Pressable>

                <XStack
                  flex={1}
                  alignItems="center"
                  gap="$2"
                  backgroundColor={chrome.cardBorder}
                  borderRadius={12}
                  paddingHorizontal="$3"
                  height={44}>
                  <Search color={chrome.subtleText} size={18} />
                  <Input
                    // Remount on open so it autofocuses; on close it mounts
                    // unfocused, dismissing the keyboard.
                    key={open ? "open" : "closed"}
                    autoFocus={open}
                    flex={1}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t("quran.search.placeholder")}
                    backgroundColor="transparent"
                    borderWidth={0}
                    paddingHorizontal={0}
                    fontSize={16}
                  />
                  {query.length > 0 && (
                    <Pressable
                      onPress={() => setQuery("")}
                      accessibilityRole="button"
                      accessibilityLabel={t("a11y.clear", { defaultValue: "Clear" })}
                      hitSlop={8}>
                      <X color={chrome.subtleText} size={18} />
                    </Pressable>
                  )}
                </XStack>
              </XStack>

              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                scrollEventThrottle={16}
                onScroll={(e) => scrollY.set(e.nativeEvent.contentOffset.y)}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag">
                {hasQuery && (
                  <>
                    {hlHits.length > 0 && (
                      <>
                        <SectionLabel chrome={chrome} text={t("quran.library.highlights")} />
                        {hlHits.map((h) => (
                          <HighlightRow
                            key={`h-${h.surah}:${h.ayah}`}
                            chrome={chrome}
                            hit={h}
                            label={labels[h.color] ?? t(`quran.highlight.color.${h.color}`)}
                            onPress={() => jumpTo(h.page)}
                          />
                        ))}
                      </>
                    )}
                    {surahHits.length > 0 && (
                      <>
                        <SectionLabel chrome={chrome} text={t("quran.browse.surahs")} />
                        {surahHits.map((s) => (
                          <SurahRow
                            key={`s-${s.number}`}
                            chrome={chrome}
                            surah={s}
                            onPress={() => jumpTo(s.pageStart)}
                          />
                        ))}
                      </>
                    )}
                    {hits.length > 0 && (
                      <>
                        <SectionLabel chrome={chrome} text={t("quran.browse.verses")} />
                        {hits.map((hit) => (
                          <VerseRow
                            key={`v-${hit.surahNumber}:${hit.ayahNumber}`}
                            chrome={chrome}
                            hit={hit}
                            onPress={() => jumpTo(hit.page)}
                          />
                        ))}
                      </>
                    )}
                    {empty && (
                      <YStack paddingVertical="$10" alignItems="center" gap="$2">
                        <Search color={chrome.subtleText} size={28} />
                        <Text fontSize={14} fontWeight="600" color={chrome.subtleText}>
                          {t("quran.browse.noResults")}
                        </Text>
                      </YStack>
                    )}
                  </>
                )}
              </ScrollView>
            </YStack>
          </GestureDetector>
        </Animated.View>
      </>
    );
  }
);

QuranSearchOverlay.displayName = "QuranSearchOverlay";

const SectionLabel = ({
  chrome,
  text,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  text: string;
}) => (
  <Text
    fontSize={13}
    fontWeight="700"
    color={chrome.subtleText}
    paddingTop="$3"
    paddingBottom="$1"
    paddingHorizontal="$1">
    {text}
  </Text>
);

const HighlightRow = ({
  chrome,
  hit,
  label,
  onPress,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  hit: HighlightHit;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${localizedSurahName(hit.surah)} ${hit.ayah}`}>
    <YStack gap="$1.5" paddingVertical="$3" borderBottomWidth={1} borderColor="$borderColor">
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$2">
          <View
            width={10}
            height={10}
            borderRadius={5}
            backgroundColor={HIGHLIGHT_COLORS[hit.color].solid}
          />
          <Text
            fontSize={13}
            fontWeight="600"
            color={chrome.text}
            style={{ fontFamily: metadataFontFamily() }}>
            {localizedSurahName(hit.surah)} : {formatNumberToLocale(String(hit.ayah))}
          </Text>
        </XStack>
        <Text fontSize={11} color={chrome.subtleText}>
          {label}
        </Text>
      </XStack>
      <Text
        numberOfLines={2}
        style={{
          fontSize: 18,
          lineHeight: 32,
          writingDirection: "rtl",
          textAlign: "right",
          fontFamily: QURAN_FONT_FAMILY,
          color: chrome.text,
        }}>
        {hit.text}
      </Text>
    </YStack>
  </Pressable>
);

const SurahRow = ({
  chrome,
  surah,
  onPress,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  surah: SurahMeta;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={localizedSurahName(surah.number)}>
    <XStack
      alignItems="center"
      gap="$3"
      paddingVertical="$3"
      borderBottomWidth={1}
      borderColor="$borderColor">
      <YStack
        width={34}
        height={34}
        borderRadius={17}
        alignItems="center"
        justifyContent="center"
        backgroundColor={chrome.cardBorder}>
        <Text fontSize={13} fontWeight="700" color={chrome.text}>
          {formatNumberToLocale(String(surah.number))}
        </Text>
      </YStack>
      <YStack flex={1}>
        <Text
          fontSize={15}
          fontWeight="600"
          color={chrome.text}
          style={{ fontFamily: metadataFontFamily() }}>
          {localizedSurahName(surah.number)}
        </Text>
        <Text fontSize={12} color={chrome.subtleText}>
          {surah.nameTransliterated}
        </Text>
      </YStack>
    </XStack>
  </Pressable>
);

const VerseRow = ({
  chrome,
  hit,
  onPress,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  hit: AyahSearchHit;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${localizedSurahName(hit.surahNumber)} ${hit.ayahNumber}`}>
    <YStack gap="$1.5" paddingVertical="$3" borderBottomWidth={1} borderColor="$borderColor">
      <XStack alignItems="center" justifyContent="space-between">
        <Text
          fontSize={13}
          fontWeight="600"
          color={chrome.text}
          style={{ fontFamily: metadataFontFamily() }}>
          {localizedSurahName(hit.surahNumber)} : {formatNumberToLocale(String(hit.ayahNumber))}
        </Text>
        <Text fontSize={11} color={chrome.subtleText}>
          {formatNumberToLocale(String(hit.page))}
        </Text>
      </XStack>
      <Text
        numberOfLines={2}
        style={{
          fontSize: 18,
          lineHeight: 32,
          writingDirection: "rtl",
          textAlign: "right",
          fontFamily: QURAN_FONT_FAMILY,
          color: chrome.text,
        }}>
        {hit.text}
      </Text>
    </YStack>
  </Pressable>
);

export default QuranSearchOverlay;
