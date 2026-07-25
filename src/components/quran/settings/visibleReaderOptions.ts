import { ReaderViewMode, ScrollDirection } from "@/enums/quran";

export type ReaderOptionsInput = {
  readerMode: ReaderViewMode;
  scrollDirection: ScrollDirection;
  isLargeDevice: boolean;
};

export type ReaderOptionsVisibility = {
  fontSize: boolean;
  twoPageSpread: boolean;
};

// Font size only applies to reflowable text; two-page spread needs both the
// width of a large device and a horizontal page-turn.
export const visibleReaderOptions = ({
  readerMode,
  scrollDirection,
  isLargeDevice,
}: ReaderOptionsInput): ReaderOptionsVisibility => ({
  fontSize: readerMode === ReaderViewMode.TEXT,
  twoPageSpread: isLargeDevice && scrollDirection === ScrollDirection.HORIZONTAL,
});
