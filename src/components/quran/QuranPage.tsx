import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { YStack } from "tamagui";

import {
  BookmarkColor,
  HighlightColor,
  MushafVersion,
  OrnamentAsset,
  OrnamentCategory,
  QuranThemeType,
  ReadAlongGranularity,
} from "@/enums/quran";
import {
  LINES_PER_PAGE,
  QURAN_THEME_COLORS,
  IMAGE_SOURCE_WIDTH,
  IMAGE_SOURCE_LINE_HEIGHT,
  highlightTint,
  BOOKMARK_COLORS,
  BUNDLED_ORNAMENT_META,
  MARKER_BOX_SOURCE_PX,
  SURAH_FRAME_ADJUSTMENTS,
  SURAH_FRAME_NO_ADJUSTMENT,
} from "@/constants/Quran";
import { localizedSurahName } from "@/utils/surahName";
import { effectiveOrnamentStyle } from "@/utils/quranOrnaments";
import { usePageData } from "@/hooks/usePageData";
import { useAyahSelection } from "@/hooks/useAyahSelection";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useBookmarkStore } from "@/stores/quranBookmarks";
import { useQuranStore } from "@/stores/quran";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE, QURAN_QUEUE_KIND } from "@/types/quran-audio";
import { useMutashabihatKeys } from "@/hooks/useMutashabihatKeys";
import LineImage from "@/components/quran/LineImage";
import PageImage from "@/components/quran/PageImage";
import LineShimmer from "@/components/quran/LineShimmer";
import PageHeader from "@/components/quran/PageHeader";
import PageNumber from "@/components/quran/PageNumber";
import AyahMarker from "@/components/quran/AyahMarker";
import SurahFrame from "@/components/quran/SurahFrame";

const LONG_PRESS_MS = 400;
// Must exceed the page-swipe pan's minDistance(15) to avoid a no-op jitter band.
const LONG_PRESS_MAX_DIST = 20;

// Stable empty rect list, so the common "nothing to tint" case keeps a constant
// identity instead of allocating a fresh [] each render.
const NO_RECTS: { left: number; top: number; width: number; height: number }[] = [];

interface QuranPageProps {
  page: number;
  version: MushafVersion;
  quranTheme: QuranThemeType;
  width: number;
  // Spread page side for the running header (surah → outer edge). Default single.
  side?: "left" | "right" | "single";
  onAyahLongPress?: (surah: number, ayah: number) => void;
  onSurahLongPress?: (surah: number) => void;
  selectedAyah?: { surah: number; ayah: number } | null;
}

// Constant 1..15 line numbers — hoisted so it isn't reallocated every render.
const PAGE_LINE_NUMBERS = Array.from({ length: LINES_PER_PAGE }, (_, i) => i + 1);

// The read-along word highlight glides between words rather than hard-stepping:
// motion reads as continuous tracking and masks the aligner's ~±70ms boundary
// noise that a discrete jump would expose. A quick spring gives an organic
// arrival with a whisper of settle; the pad lets the tint breathe around the
// glyphs instead of hugging their exact bounds.
const WORD_GLIDE_SPRING = { damping: 22, stiffness: 380, mass: 0.7 } as const;
const WORD_PAD_X = 3;
const WORD_PAD_Y = 2;

type HighlightRect = { left: number; top: number; width: number; height: number };

const AnimatedWordHighlight = ({ rect, color }: { rect: HighlightRect; color: string }) => {
  const reduceMotion = useReducedMotion();
  const left = useSharedValue(rect.left - WORD_PAD_X);
  const top = useSharedValue(rect.top - WORD_PAD_Y);
  const width = useSharedValue(rect.width + 2 * WORD_PAD_X);
  const height = useSharedValue(rect.height + 2 * WORD_PAD_Y);

  useEffect(() => {
    const to = (v: number) => (reduceMotion ? v : withSpring(v, WORD_GLIDE_SPRING));
    left.value = to(rect.left - WORD_PAD_X);
    top.value = to(rect.top - WORD_PAD_Y);
    width.value = to(rect.width + 2 * WORD_PAD_X);
    height.value = to(rect.height + 2 * WORD_PAD_Y);
  }, [rect, reduceMotion, left, top, width, height]);

  const style = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    width: width.value,
    height: height.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", borderRadius: 5, backgroundColor: color }, style]}
    />
  );
};

const QuranPage = ({
  page,
  version,
  quranTheme,
  width,
  side,
  onAyahLongPress,
  onSurahLongPress,
  selectedAyah,
}: QuranPageProps) => {
  // Start at 0 so every line image + overlay (markers, tints, ribbons) waits for
  // the real onLayout height — they're all guarded by `lineHeight > 0`. Seeding an
  // estimate here made them render once at the wrong position then snap on measure.
  const [linesAreaHeight, setLinesAreaHeight] = useState(0);
  const pressableRef = useRef<View>(null);

  const {
    pageAvailable,
    isPageMode,
    surahHeaderLines,
    juz,
    rubStart,
    glyphBounds,
    sourcePageHeight,
    pageDataLoaded,
  } = usePageData(version, page);

  // The page image and its ayah markers render together only once glyph data has
  // loaded — otherwise the image shows first and markers pop in a beat later.
  const ready = pageAvailable && pageDataLoaded;

  const onLinesLayout = useCallback((event: LayoutChangeEvent) => {
    setLinesAreaHeight(event.nativeEvent.layout.height);
  }, []);

  // --- Scaling math ---
  // coverScale: how the source image width maps to screen width
  const coverScale = width / IMAGE_SOURCE_WIDTH;
  // lineHeight: screen height allocated per line slot
  const lineHeight = linesAreaHeight > 0 ? Math.floor(linesAreaHeight / LINES_PER_PAGE) : 0;

  // For LINE mode: each line image scales independently
  const scaledLineHeight = IMAGE_SOURCE_LINE_HEIGHT * coverScale;
  const lineCoverClipY = (scaledLineHeight - lineHeight) / 2;

  // For PAGE mode: image scaled by width then compressed vertically via scaleY
  const pageScaleX = width / IMAGE_SOURCE_WIDTH;
  const srcLineHeight =
    sourcePageHeight > 0 ? sourcePageHeight / LINES_PER_PAGE : IMAGE_SOURCE_LINE_HEIGHT;
  const scaledPageHeight =
    sourcePageHeight > 0 ? Math.round(sourcePageHeight * pageScaleX) : linesAreaHeight;
  const pageScaleY = scaledPageHeight > 0 ? linesAreaHeight / scaledPageHeight : 1;

  const geometry = useMemo(
    () => ({
      isPageMode,
      coverScale,
      lineHeight,
      lineCoverClipY,
      pageScaleX,
      pageScaleY,
      srcLineHeight,
    }),
    [isPageMode, coverScale, lineHeight, lineCoverClipY, pageScaleX, pageScaleY, srcLineHeight]
  );

  const { highlightedAyah, clearHighlight, handlePress, handleLongPress } = useAyahSelection({
    version,
    page,
    glyphBounds,
    surahHeaderLines,
    geometry,
    pressableRef,
    onAyahLongPress,
    onSurahLongPress,
  });

  // Long-press as a native RNGH gesture so it coordinates with the page-swipe pan
  // instead of a JS Pressable, whose long-press the pan could cancel on Android.
  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(LONG_PRESS_MS)
        .maxDistance(LONG_PRESS_MAX_DIST)
        // onStart runs as a worklet on the UI thread; hop to JS for the hit-test.
        // e.x/e.y are relative to the page view — no window-coord conversion.
        .onStart((e) => scheduleOnRN(handleLongPress, e.x, e.y)),
    [handleLongPress]
  );

  // Drop the highlight when the ayah's action sheet closes (selection cleared).
  useEffect(() => {
    if (!selectedAyah) clearHighlight();
  }, [selectedAyah, clearHighlight]);

  // Header surah is derived from the page's own glyphs (each carries its
  // surahNumber), so continuation pages show the running surah — and it's
  // naturally blank while the page is still downloading (no glyphs yet).
  const headerSurahNumber = useMemo(() => {
    if (!pageAvailable || glyphBounds.length === 0) return null;
    return glyphBounds.reduce((min, g) => Math.min(min, g.surahNumber), Infinity);
  }, [pageAvailable, glyphBounds]);
  const headerSurah = headerSurahNumber != null ? localizedSurahName(headerSurahNumber) : "";

  // Highlighted ayahs present on this page, keyed "surah:ayah" → colour. Matched
  // by glyph membership (not the stored page) so an ayah that spills across a
  // page boundary still tints on both pages.
  const highlights = useHighlightStore((s) => s.highlights);
  const pageHighlights = useMemo(() => {
    const map = new Map<string, HighlightColor>();
    if (glyphBounds.length === 0 || highlights.length === 0) return map;
    const present = new Set(glyphBounds.map((g) => `${g.surahNumber}:${g.ayahNumber}`));
    for (const h of highlights) {
      const key = `${h.surah}:${h.ayah}`;
      if (present.has(key)) map.set(key, h.color);
    }
    return map;
  }, [highlights, glyphBounds]);

  // Bookmarked ayahs present on this page, keyed "surah:ayah" → ribbon colour.
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const pageBookmarks = useMemo(() => {
    const map = new Map<string, BookmarkColor>();
    if (glyphBounds.length === 0 || bookmarks.length === 0) return map;
    const present = new Set(glyphBounds.map((g) => `${g.surahNumber}:${g.ayahNumber}`));
    for (const b of bookmarks) {
      const key = `${b.surah}:${b.ayah}`;
      if (present.has(key)) map.set(key, b.color);
    }
    return map;
  }, [bookmarks, glyphBounds]);

  // Screen-space rects covering an ayah's glyphs, one per line it occupies.
  const rectsForAyah = useCallback(
    (surah: number, ayah: number) => {
      if (lineHeight === 0) return [];
      const ayahGlyphs = glyphBounds.filter(
        (g) => g.surahNumber === surah && g.ayahNumber === ayah
      );
      if (ayahGlyphs.length === 0) return [];

      const lineMap = new Map<number, { minX: number; maxX: number }>();
      for (const g of ayahGlyphs) {
        const existing = lineMap.get(g.line);
        const gRight = g.x + g.width;
        if (existing) {
          existing.minX = Math.min(existing.minX, g.x);
          existing.maxX = Math.max(existing.maxX, gRight);
        } else {
          lineMap.set(g.line, { minX: g.x, maxX: gRight });
        }
      }

      if (isPageMode) {
        return Array.from(lineMap.entries()).map(([line, { minX, maxX }]) => ({
          left: minX * pageScaleX,
          top: (line - 1) * srcLineHeight * pageScaleX * pageScaleY,
          width: (maxX - minX) * pageScaleX,
          height: srcLineHeight * pageScaleX * pageScaleY,
        }));
      }

      return Array.from(lineMap.entries()).map(([line, { minX, maxX }]) => ({
        left: minX * coverScale,
        top: (line - 1) * lineHeight,
        width: (maxX - minX) * coverScale,
        height: lineHeight,
      }));
    },
    [glyphBounds, lineHeight, isPageMode, pageScaleX, pageScaleY, srcLineHeight, coverScale]
  );

  // Transient long-press highlight; skipped when the ayah is highlighted (its
  // persistent colour tint already covers it).
  const highlightRects = useMemo(() => {
    if (!highlightedAyah) return [];
    if (pageHighlights.has(`${highlightedAyah.surah}:${highlightedAyah.ayah}`)) return [];
    return rectsForAyah(highlightedAyah.surah, highlightedAyah.ayah);
  }, [highlightedAyah, pageHighlights, rectsForAyah]);

  // Search-jump highlight: tint the target ayah's word-rects like a long-press
  // selection; QuranReader clears `flashAyah` after a couple of seconds. Skipped
  // when the ayah is a saved highlight (its colour tint already marks it).
  const flashAyah = useQuranStore((s) => s.flashAyah);
  const flashRects = useMemo(() => {
    if (!flashAyah) return [];
    if (pageHighlights.has(`${flashAyah.surah}:${flashAyah.ayah}`)) return [];
    return rectsForAyah(flashAyah.surah, flashAyah.ayah);
  }, [flashAyah, pageHighlights, rectsForAyah]);

  // Audio read-along highlight. To avoid every mounted page re-rendering on each
  // recited-word change, this page subscribes narrowly: `hasWord` (word-mode on/off,
  // changes per ayah) and `pageWord` (the recited word *only if it's on this page*,
  // else null). A page that doesn't own the current word therefore doesn't re-render
  // as the word advances on another page — only the owning page (and the one the word
  // leaves) re-render per word.
  const readAlong = useQuranStore((s) => s.readAlong);
  const highlightGranularity = useQuranStore((s) => s.readAlongGranularity);
  const readAlongVerse = useQuranStore((s) => s.readAlongVerse);
  const hasWord = useQuranStore((s) => s.readAlongWord != null);
  const pageWord = useQuranStore((s) => {
    const w = s.readAlongWord;
    return w && w.page === page ? w : null;
  });
  const playingSurah = useQuranAudioStore((s) => s.currentSurah);
  const playingAyah = useQuranAudioStore((s) => s.currentAyah);
  const playerActive = useQuranAudioStore((s) => s.playerState !== QURAN_PLAYER_STATE.IDLE);
  // Reader highlight follows only reader (ayah) playback, not a Listen (surah) session.
  const playingReaderAudio = useQuranAudioStore(
    (s) => s.queue?.kind != null && s.queue.kind !== QURAN_QUEUE_KIND.SURAH
  );
  const playingRects = useMemo(() => {
    if (
      !readAlong ||
      !playerActive ||
      !playingReaderAudio ||
      playingSurah == null ||
      playingAyah == null
    )
      return NO_RECTS;
    if (lineHeight === 0) return NO_RECTS;
    if (pageHighlights.has(`${playingSurah}:${playingAyah}`)) return NO_RECTS;

    // Word mode: a per-word timing is active for the recited ayah — tint just that
    // word, and only on the page it lives on.
    if (hasWord) {
      // The published word may briefly belong to the PREVIOUS ayah — the hook holds
      // the last word lit through the ayah boundary (the reciter's breath), so draw
      // whatever it publishes rather than gating on the recited ayah.
      const w = pageWord;
      if (!w) return NO_RECTS;
      if (isPageMode) {
        return [
          {
            left: w.x * pageScaleX,
            top:
              (w.line - 1) * srcLineHeight * pageScaleX * pageScaleY +
              w.y * pageScaleX * pageScaleY,
            width: w.width * pageScaleX,
            height: w.height * pageScaleX * pageScaleY,
          },
        ];
      }
      return [
        {
          left: w.x * coverScale,
          top: (w.line - 1) * lineHeight + w.y * coverScale - lineCoverClipY,
          width: w.width * coverScale,
          height: w.height * coverScale,
        },
      ];
    }

    // Word mode: whole-ayah tint only when this ayah genuinely can't track words
    // (readAlongVerse); otherwise show nothing so a new ayah never flashes the
    // whole-ayah tint before per-word starts.
    if (highlightGranularity === ReadAlongGranularity.WORD) {
      return readAlongVerse ? rectsForAyah(playingSurah, playingAyah) : NO_RECTS;
    }
    return rectsForAyah(playingSurah, playingAyah);
  }, [
    readAlong,
    highlightGranularity,
    readAlongVerse,
    playingReaderAudio,
    hasWord,
    pageWord,
    playerActive,
    playingSurah,
    playingAyah,
    lineHeight,
    isPageMode,
    coverScale,
    lineCoverClipY,
    pageScaleX,
    pageScaleY,
    srcLineHeight,
    pageHighlights,
    rectsForAyah,
  ]);

  // Persistent per-highlight colour tints.
  const highlightTintRects = useMemo(() => {
    const out: { left: number; top: number; width: number; height: number; tint: string }[] = [];
    for (const [key, color] of pageHighlights) {
      const [surah, ayah] = key.split(":").map(Number);
      for (const r of rectsForAyah(surah, ayah)) {
        out.push({ ...r, tint: highlightTint(color, quranTheme) });
      }
    }
    return out;
  }, [pageHighlights, rectsForAyah, quranTheme]);

  // Markers draw at a CONSTANT size (the nominal 112px box in 232px source
  // units) centered on their glyph box — per-page font fitting makes the raw
  // glyph boxes vary, which read as randomly-sized medallions.
  const markerPositions = useMemo(() => {
    if (lineHeight === 0) return [];
    const markers = glyphBounds.filter((g) => g.isMarker);
    return markers.map((g) => {
      if (isPageMode) {
        const w = MARKER_BOX_SOURCE_PX * pageScaleX;
        const h = MARKER_BOX_SOURCE_PX * pageScaleX * pageScaleY;
        const cx = (g.x + g.width / 2) * pageScaleX;
        const cy =
          (g.line - 1) * srcLineHeight * pageScaleX * pageScaleY +
          (g.y + g.height / 2) * pageScaleX * pageScaleY;
        return {
          x: cx - w / 2,
          y: cy - h / 2,
          width: w,
          height: h,
          surahNumber: g.surahNumber,
          ayahNumber: g.ayahNumber,
        };
      }
      const side = MARKER_BOX_SOURCE_PX * coverScale;
      const cx = (g.x + g.width / 2) * coverScale;
      const cy = (g.line - 1) * lineHeight + (g.y + g.height / 2) * coverScale - lineCoverClipY;
      return {
        x: cx - side / 2,
        y: cy - side / 2,
        width: side,
        height: side,
        surahNumber: g.surahNumber,
        ayahNumber: g.ayahNumber,
      };
    });
  }, [
    glyphBounds,
    lineHeight,
    isPageMode,
    coverScale,
    lineCoverClipY,
    pageScaleX,
    pageScaleY,
    srcLineHeight,
  ]);

  // Active surah-frame style + its pack metadata (installed pack overrides the
  // bundled nedaa values); the frame's aspect comes from that metadata.
  const surahFrameStyle = useQuranStore((s) =>
    effectiveOrnamentStyle(
      s.ornamentStyle[OrnamentCategory.SURAH_FRAME],
      s.ornamentResolved[OrnamentCategory.SURAH_FRAME]?.[version]
    )
  );
  const surahFrameMeta =
    useQuranStore((s) => s.ornamentMeta[OrnamentCategory.SURAH_FRAME]) ??
    BUNDLED_ORNAMENT_META[OrnamentCategory.SURAH_FRAME];

  // Surah-opening banners: a frame on each surah-header line. Full text-block
  // width (edge to edge, like the printed band), height from the style's aspect,
  // centred on the header line — with Y clamped inside the lines area so a
  // clipped line slot (squarish screens, spreads) never pushes the frame up
  // over the running header or past the last line.
  // The band must land exactly where the line image's baked name lands, so it
  // uses the SAME mapping the image does: LINE mode = cover (scale by the
  // larger ratio, center the overflow), PAGE mode = width-fit + scaleY. Each
  // frame is clipped to its line slot, mirroring the image's own clipping.
  const surahFramePositions = useMemo(() => {
    if (lineHeight === 0) return [];
    const base = isPageMode ? srcLineHeight * pageScaleX * pageScaleY : lineHeight;
    const adj = SURAH_FRAME_ADJUSTMENTS[surahFrameStyle]?.[version] ?? SURAH_FRAME_NO_ADJUSTMENT;
    let bannerW: number;
    let bannerH: number;
    if (isPageMode) {
      bannerW = width;
      bannerH = IMAGE_SOURCE_LINE_HEIGHT * pageScaleX * pageScaleY;
    } else {
      const coverRatio = Math.max(coverScale, lineHeight / IMAGE_SOURCE_LINE_HEIGHT);
      bannerW = IMAGE_SOURCE_WIDTH * coverRatio;
      bannerH = IMAGE_SOURCE_LINE_HEIGHT * coverRatio;
    }
    bannerW *= adj.scale;
    bannerH *= adj.scale;
    return Object.entries(surahHeaderLines).map(([lineStr, surahNumber]) => {
      const line = Number(lineStr);
      return {
        slotY: (line - 1) * base,
        slotHeight: base,
        x: (width - bannerW) / 2,
        y: (base - bannerH) / 2 + adj.offsetY * bannerH,
        width: bannerW,
        height: bannerH,
        surahNumber,
      };
    });
  }, [
    surahHeaderLines,
    width,
    lineHeight,
    coverScale,
    isPageMode,
    srcLineHeight,
    pageScaleX,
    pageScaleY,
    surahFrameStyle,
    version,
  ]);

  // Similar-verse markers ("huffaz mode", off by default): a small dot above the
  // ayah's end-marker for any verse on this page that belongs to a group.
  const mutashabihatKeys = useMutashabihatKeys(page);
  const mutashabihatDots = useMemo(
    () =>
      mutashabihatKeys.size === 0
        ? []
        : markerPositions.filter((m) => mutashabihatKeys.has(`${m.surahNumber}:${m.ayahNumber}`)),
    [markerPositions, mutashabihatKeys]
  );

  return (
    <YStack
      flex={1}
      width={width}
      style={{ backgroundColor: QURAN_THEME_COLORS[quranTheme].background }}>
      <PageHeader
        surahName={headerSurah}
        surahNumber={headerSurahNumber}
        juz={pageAvailable ? juz : null}
        quranTheme={quranTheme}
        side={side}
      />

      <View
        style={{
          flex: 1,
          alignItems: "center",
          backgroundColor: QURAN_THEME_COLORS[quranTheme].innerBackground,
        }}
        onLayout={onLinesLayout}>
        <GestureDetector gesture={longPressGesture}>
          <Pressable
            ref={pressableRef}
            style={{
              position: "relative",
              direction: "ltr",
            }}
            onPress={handlePress}>
            {/* Surah-frame UNDERLAY: drawn before the page/line images so the
                baked calligraphic name composites on top of the open panel.
                Clipped to the line slot, exactly like the line image itself. */}
            {ready &&
              surahFramePositions.map((s, i) => (
                <View
                  key={`surah-${i}`}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: s.slotY,
                    width,
                    height: s.slotHeight,
                    overflow: "hidden",
                  }}>
                  <SurahFrame
                    x={s.x}
                    y={s.y}
                    width={s.width}
                    height={s.height}
                    surahNumber={s.surahNumber}
                    version={version}
                    quranTheme={quranTheme}
                    styleId={surahFrameStyle}
                    panel={surahFrameMeta.assets[OrnamentAsset.FRAME]?.panel}
                    medallions={surahFrameMeta.assets[OrnamentAsset.FRAME]?.medallions}
                  />
                </View>
              ))}
            {lineHeight > 0 && ready && isPageMode && (
              <PageImage
                version={version}
                page={page}
                screenWidth={width}
                availableHeight={linesAreaHeight}
                quranTheme={quranTheme}
              />
            )}
            {lineHeight > 0 && !ready && isPageMode && (
              <LineShimmer
                screenWidth={width}
                lineHeight={linesAreaHeight}
                quranTheme={quranTheme}
              />
            )}
            {lineHeight > 0 &&
              !isPageMode &&
              PAGE_LINE_NUMBERS.map((line) =>
                ready ? (
                  <LineImage
                    key={`${page}-${line}`}
                    version={version}
                    page={page}
                    line={line}
                    screenWidth={width}
                    lineHeight={lineHeight}
                    quranTheme={quranTheme}
                  />
                ) : (
                  <LineShimmer
                    key={`shimmer-${page}-${line}`}
                    screenWidth={width}
                    lineHeight={lineHeight}
                    quranTheme={quranTheme}
                  />
                )
              )}

            {highlightTintRects.map((rect, i) => (
              <View
                key={`hl-tint-${i}`}
                style={{
                  position: "absolute",
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: rect.tint,
                  borderRadius: 2,
                }}
              />
            ))}

            {ready &&
              markerPositions.map((m, i) => {
                const bmColor = pageBookmarks.get(`${m.surahNumber}:${m.ayahNumber}`);
                return (
                  <AyahMarker
                    key={`marker-${i}`}
                    x={m.x}
                    y={m.y}
                    width={m.width}
                    height={m.height}
                    ayahNumber={m.ayahNumber}
                    version={version}
                    quranTheme={quranTheme}
                    bookmarkColor={bmColor ? BOOKMARK_COLORS[bmColor].solid : undefined}
                  />
                );
              })}

            {highlightRects.map((rect, i) => (
              <View
                key={`hl-${i}`}
                style={{
                  position: "absolute",
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: QURAN_THEME_COLORS[quranTheme].highlightColor,
                  borderRadius: 2,
                }}
              />
            ))}

            {flashRects.map((rect, i) => (
              <View
                key={`flash-${i}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: QURAN_THEME_COLORS[quranTheme].highlightColor,
                  borderRadius: 2,
                }}
              />
            ))}

            {playingRects.length === 1 ? (
              <AnimatedWordHighlight
                rect={playingRects[0]}
                color={QURAN_THEME_COLORS[quranTheme].highlightColor}
              />
            ) : (
              playingRects.map((rect, i) => (
                <View
                  key={`play-${i}`}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: QURAN_THEME_COLORS[quranTheme].highlightColor,
                    borderRadius: 2,
                  }}
                />
              ))
            )}

            {mutashabihatDots.map((m, i) => (
              <View
                key={`mut-${i}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: m.x + m.width / 2 - 2.5,
                  top: m.y - 5,
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: QURAN_THEME_COLORS[quranTheme].markerColor,
                }}
              />
            ))}
          </Pressable>
        </GestureDetector>
      </View>

      <PageNumber
        page={page}
        quranTheme={quranTheme}
        version={version}
        rubStart={rubStart}
        side={side}
      />
    </YStack>
  );
};

export default QuranPage;
