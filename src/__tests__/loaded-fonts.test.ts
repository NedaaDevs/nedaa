import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import config from "../../tamagui.config";
import { APP_FONTS } from "@/config/fonts";
import { FONT_MAPPINGS, SYSTEM_MONO_FAMILY } from "@/constants/Fonts";
import { REPO_ROOT, walkFiles } from "@/test-helpers/routeTree";

const PBXPROJ = join(REPO_ROOT, "ios", "nedaa.xcodeproj", "project.pbxproj");

/** A font package's root module, which requires every face of the family. */
const BARREL_IMPORT = /["'`]@expo-google-fonts\/[^/"'`]+(?:\/index(?:\.js)?)?["'`]/;

const localeFaces = Object.values(FONT_MAPPINGS).flatMap((faces) => Object.values(faces));

const themeFaces = Object.values(config.fonts).flatMap((font) => [
  font.family,
  ...Object.values(font.face ?? {}).flatMap((styles) => Object.values(styles ?? {})),
]);

const sources = walkFiles(`${REPO_ROOT}${sep}src`)
  .filter((path) => /\.tsx?$/.test(path) && !path.split(sep).includes("__tests__"))
  .map((path) => [relative(REPO_ROOT, path).split(sep).join("/"), readFileSync(path, "utf8")]);

describe("loaded fonts", () => {
  // A face the app names but never loads draws in a system font, with no error.
  it.each(
    [...new Set([...localeFaces, ...themeFaces])].filter((face) => face !== SYSTEM_MONO_FAMILY)
  )("loads %s", (face) => {
    expect(Object.keys(APP_FONTS)).toContain(face);
  });

  it("reads the theme's faces", () => {
    expect(new Set(themeFaces).size).toBeGreaterThan(8);
  });

  // The bundler ships every file a package root requires, used or not.
  it("imports each face from its own module", () => {
    const barrels = sources
      .filter(([, source]) => BARREL_IMPORT.test(source))
      .map(([file]) => file);

    expect(barrels).toEqual([]);
  });

  // iOS registers a bundled font only through UIAppFonts; expo-font loads these.
  it("leaves the Xcode project free of package fonts", () => {
    const pins = readFileSync(PBXPROJ, "utf8").match(/node_modules\/[^"\s]+\.(?:ttf|otf)/g);

    expect(pins).toBeNull();
  });
});
