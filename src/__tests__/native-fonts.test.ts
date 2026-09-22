import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { FONT_MAPPINGS } from "@/constants/Fonts";
import { REPO_ROOT } from "@/test-helpers/routeTree";

/**
 * `ios/` is committed, so the Xcode project pins font paths into node_modules.
 * Removing a font package leaves those pins dangling and the build fails at
 * xcodebuild with "No such file or directory", which no JS test would catch.
 */
const PBXPROJ = join(REPO_ROOT, "ios", "nedaa.xcodeproj", "project.pbxproj");

const pinnedFontPaths = (): string[] => {
  const source = readFileSync(PBXPROJ, "utf8");
  return [
    ...new Set(
      [...source.matchAll(/\.\.\/(node_modules\/[^"\s]+\.(?:ttf|otf))/g)].map((m) => m[1])
    ),
  ];
};

describe("native font references", () => {
  it("finds the pinned fonts", () => {
    expect(pinnedFontPaths().length).toBeGreaterThan(4);
  });

  it.each(pinnedFontPaths())("%s exists", (relative) => {
    expect(existsSync(join(REPO_ROOT, relative))).toBe(true);
  });

  // A face named by the app but absent from the build is a silent system fallback.
  it("pins every face the locales ask for", () => {
    const pinned = pinnedFontPaths();
    const faces = [...new Set(Object.values(FONT_MAPPINGS).flatMap((set) => Object.values(set)))];

    const missing = faces.filter((face) => {
      const [family, weight] = face.split("-");
      // The filename carries the numeric weight: IBMPlexSansArabic_400Regular.ttf.
      // Anchored, since IBMPlexSans is a prefix of IBMPlexSansArabic.
      const file = new RegExp(`/${family}_\\d+${weight}\\.ttf$`);
      return !pinned.some((path) => file.test(path));
    });

    expect(missing).toEqual([]);
  });
});
