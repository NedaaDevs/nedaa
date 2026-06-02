import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import { Platform, StatusBar, View } from "react-native";
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
  geometry: PageGeometry;
  pressableRef: RefObject<View | null>;
};

// Tap-to-select on the mushaf page: maps a touch to source coordinates, finds
// the glyph under it, and tracks the highlighted ayah. A long-press selects the
// word under the finger (a text glyph); a tap selects an ayah-end marker.
export const useAyahHitTest = ({ version, page, glyphBounds, geometry, pressableRef }: Params) => {
  const [highlightedAyah, setHighlightedAyah] = useState<HighlightedAyah | null>(null);

  // A fresh page starts with nothing highlighted.
  useEffect(() => {
    setHighlightedAyah(null);
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

  // Both gestures resolve the glyph under the touch; they differ only in which
  // glyph kind they match — a tap matches an ayah-end marker, a long-press a word.
  const resolveHit = useCallback(
    (event: GestureResponderEvent, wantMarker: boolean) => {
      if (glyphBounds.length === 0 || lineHeight === 0) {
        setHighlightedAyah(null);
        return;
      }
      pressableRef.current?.measureInWindow((px, py) => {
        const statusBarOffset = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
        const touchX = event.nativeEvent.pageX - px;
        const touchY = event.nativeEvent.pageY - py - statusBarOffset;
        const { sourceX, sourceY, sourceLine } = toSourceCoords(touchX, touchY);

        const hit = glyphBounds.find(
          (g) =>
            g.isMarker === wantMarker &&
            g.line === sourceLine &&
            sourceX >= g.x &&
            sourceX <= g.x + g.width &&
            sourceY >= g.y &&
            sourceY <= g.y + g.height
        );

        setHighlightedAyah(
          hit ? { surah: hit.surahNumber, ayah: hit.ayahNumber, touchX, touchY } : null
        );
      });
    },
    [glyphBounds, lineHeight, toSourceCoords, pressableRef]
  );

  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => resolveHit(event, false),
    [resolveHit]
  );
  const handlePress = useCallback(
    (event: GestureResponderEvent) => resolveHit(event, true),
    [resolveHit]
  );

  return { highlightedAyah, handlePress, handleLongPress };
};
