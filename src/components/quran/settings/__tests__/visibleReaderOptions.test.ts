import { visibleReaderOptions } from "@/components/quran/settings/visibleReaderOptions";
import { ReaderViewMode, ScrollDirection } from "@/enums/quran";

const base = {
  readerMode: ReaderViewMode.MADINAH,
  scrollDirection: ScrollDirection.HORIZONTAL,
  isLargeDevice: false,
};

describe("visibleReaderOptions", () => {
  it("hides the font size stepper outside text mode", () => {
    expect(visibleReaderOptions(base).fontSize).toBe(false);
  });

  it("shows the font size stepper in text mode", () => {
    expect(visibleReaderOptions({ ...base, readerMode: ReaderViewMode.TEXT }).fontSize).toBe(true);
  });

  it("hides two-page spread on small devices", () => {
    expect(visibleReaderOptions(base).twoPageSpread).toBe(false);
  });

  it("hides two-page spread on large devices scrolling vertically", () => {
    expect(
      visibleReaderOptions({
        ...base,
        isLargeDevice: true,
        scrollDirection: ScrollDirection.VERTICAL,
      }).twoPageSpread
    ).toBe(false);
  });

  it("shows two-page spread on large devices scrolling horizontally", () => {
    expect(visibleReaderOptions({ ...base, isLargeDevice: true }).twoPageSpread).toBe(true);
  });

  it("keeps font size and spread independent", () => {
    const result = visibleReaderOptions({
      readerMode: ReaderViewMode.TEXT,
      scrollDirection: ScrollDirection.HORIZONTAL,
      isLargeDevice: true,
    });
    expect(result).toEqual({ fontSize: true, twoPageSpread: true });
  });
});
