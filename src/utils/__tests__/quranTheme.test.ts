import { resolveQuranTheme } from "@/utils/quranTheme";
import { QuranTheme, MushafVersion } from "@/enums/quran";

describe("resolveQuranTheme", () => {
  const mono = { version: MushafVersion.V1, darkInstalled: false };

  it("no override follows the app scheme onto Nedaa paper", () => {
    expect(
      resolveQuranTheme({ ...mono, override: false, theme: QuranTheme.SEPIA, appIsDark: false })
    ).toBe(QuranTheme.NEDAA_LIGHT);
    expect(
      resolveQuranTheme({ ...mono, override: false, theme: QuranTheme.SEPIA, appIsDark: true })
    ).toBe(QuranTheme.NEDAA_DARK);
  });

  it("override returns the picked theme regardless of scheme", () => {
    expect(
      resolveQuranTheme({ ...mono, override: true, theme: QuranTheme.LIGHT, appIsDark: true })
    ).toBe(QuranTheme.LIGHT);
    expect(
      resolveQuranTheme({ ...mono, override: true, theme: QuranTheme.SEPIA, appIsDark: true })
    ).toBe(QuranTheme.SEPIA);
    expect(
      resolveQuranTheme({ ...mono, override: true, theme: QuranTheme.DARK, appIsDark: false })
    ).toBe(QuranTheme.DARK);
  });

  it("colored edition on dark paper without its dark bundle falls back to Sepia", () => {
    expect(
      resolveQuranTheme({
        override: false,
        theme: QuranTheme.SEPIA,
        appIsDark: true,
        version: MushafVersion.V4,
        darkInstalled: false,
      })
    ).toBe(QuranTheme.SEPIA);
    expect(
      resolveQuranTheme({
        override: false,
        theme: QuranTheme.SEPIA,
        appIsDark: true,
        version: MushafVersion.V4,
        darkInstalled: true,
      })
    ).toBe(QuranTheme.NEDAA_DARK);
  });
});
