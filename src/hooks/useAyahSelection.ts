import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import { View } from "react-native";
import type { GestureResponderEvent } from "react-native";

import { MushafVersion } from "@/enums/quran";
import { GlyphBound } from "@/types/quran";

export type HighlightedAyah = {
  surah: number;
  ayah: number;
  touchX: number;
  touchY: number;
};

// Screen↔source scaling for the current page, in both render modes.
export type PageGeometry = {
  isPageMode: boolean;
  coverScale: number;
  lineHeight: number;
  lineCoverClipY: number;
  pageScaleX: number;
  pageScaleY: number;
  srcLineHeight: number;
};

type Params = {
  version: MushafVersion;
  page: number;
  glyphBounds: GlyphBound[];
  surahHeaderLines: Record<number, number>;
  geometry: PageGeometry;
  pressableRef: RefObject<View | null>;
  // Long-pressing an ayah opens its action sheet (in addition to highlighting it).
  onAyahLongPress?: (surah: number, ayah: number) => void;
  // Long-pressing a surah header opens its info sheet.
  onSurahLongPress?: (surah: number) => void;
};

// Tap-to-select on the mushaf page: maps a touch to source coordinates, finds
// the glyph under it, and tracks the highlighted ayah. A long-press selects the
// word under the finger (a text glyph); a tap selects an ayah-end marker. A
// long-press on a surah-header line resolves to that surah instead (the header
// has no glyphs).
export const useAyahSelection = ({
  version,
  page,
  glyphBounds,
  surahHeaderLines,
  geometry,
  pressableRef,
  onAyahLongPress,
  onSurahLongPress,
}: Params) => {
  const [highlightedAyah, setHighlightedAyah] = useState<HighlightedAyah | null>(null);

  // A fresh page starts with nothing selected. Deferred to the react-compiler
  // migration (set-state-in-effect backlog).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setHighlightedAyah(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [page, version]);

  const {
    isPageMode,
    coverScale,
    lineHeight,
    lineCoverClipY,
    pageScaleX,
    pageScaleY,
    srcLineHeight,
  } = geometry;

  const toSourceCoords = useCallback(
    (touchX: number, touchY: number) => {
      if (isPageMode) {
        const srcX = touchX / pageScaleX;
        const srcY = touchY / (pageScaleX * pageScaleY);
        const sourceLine = Math.floor(srcY / srcLineHeight) + 1;
        return { sourceX: srcX, sourceY: srcY - (sourceLine - 1) * srcLineHeight, sourceLine };
      }
      const sourceLine = Math.floor(touchY / lineHeight) + 1;
      return {
        sourceX: touchX / coverScale,
        sourceY: (touchY - (sourceLine - 1) * lineHeight + lineCoverClipY) / coverScale,
        sourceLine,
      };
    },
    [isPageMode, pageScaleX, pageScaleY, srcLineHeight, coverScale, lineHeight, lineCoverClipY]
  );

  // Both gestures resolve the glyph under the touch (page-local coords); they
  // differ only in which glyph kind they match — a tap matches an ayah-end
  // marker, a long-press a word.
  const resolveHit = useCallback(
    (touchX: number, touchY: number, wantMarker: boolean) => {
      if (lineHeight === 0) return;
      const { sourceX, sourceY, sourceLine } = toSourceCoords(touchX, touchY);

      // Long-press on a surah-header line resolves to that surah (the header
      // band has no glyphs to hit-test).
      const headerSurah = surahHeaderLines[sourceLine];
      if (!wantMarker && headerSurah) {
        setHighlightedAyah(null);
        onSurahLongPress?.(headerSurah);
        return;
      }

      if (glyphBounds.length === 0) {
        setHighlightedAyah(null);
        return;
      }

      let hit = glyphBounds.find(
        (g) =>
          g.isMarker === wantMarker &&
          g.line === sourceLine &&
          sourceX >= g.x &&
          sourceX <= g.x + g.width &&
          sourceY >= g.y &&
          sourceY <= g.y + g.height
      );

      // Long-press near-miss: a word press landing in inter-word spacing
      // resolves to the nearest word on the same line.
      if (!hit && !wantMarker) {
        let bestDist = Infinity;
        for (const g of glyphBounds) {
          if (g.isMarker || g.line !== sourceLine) continue;
          const dx = Math.max(g.x - sourceX, 0, sourceX - (g.x + g.width));
          const dy = Math.max(g.y - sourceY, 0, sourceY - (g.y + g.height));
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            hit = g;
          }
        }
      }

      setHighlightedAyah(
        hit ? { surah: hit.surahNumber, ayah: hit.ayahNumber, touchX, touchY } : null
      );
      if (hit && !wantMarker) onAyahLongPress?.(hit.surahNumber, hit.ayahNumber);
    },
    [glyphBounds, lineHeight, toSourceCoords, surahHeaderLines, onAyahLongPress, onSurahLongPress]
  );

  // Long-press is an RNGH LongPress gesture; its e.x/e.y are already relative to
  // the page view, so no window math (which broke under edge-to-edge Android).
  const handleLongPress = useCallback(
    (x: number, y: number) => resolveHit(x, y, false),
    [resolveHit]
  );
  // Tap stays on the RN Pressable. locationX/Y is child-relative on the stacked
  // line images, so convert window coords (pageX/Y) to page-local instead.
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      pressableRef.current?.measureInWindow((px, py) => resolveHit(pageX - px, pageY - py, true));
    },
    [resolveHit, pressableRef]
  );

  const clearHighlight = useCallback(() => setHighlightedAyah(null), []);

  return {
    highlightedAyah,
    clearHighlight,
    handlePress,
    handleLongPress,
  };
};
