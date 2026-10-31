import { readFileSync } from "node:fs";
import { join } from "node:path";

import { screenshotReadyId } from "@/constants/E2E";
import { SCREENSHOT_LOCALES, SCREENSHOT_THEMES } from "@/constants/Screenshot";
import { parseScreenshotDeepLink } from "@/screenshot-mode/parseScreenshotDeepLink";
import { getPreset } from "@/screenshot-mode/presets";
import { REPO_ROOT } from "@/test-helpers/routeTree";

// The script names the shots and the flow builds their links; both are plain
// text, so a renamed screen or seed would otherwise fail only on CI.
const script = readFileSync(join(REPO_ROOT, "scripts", "ci", "visual-check.sh"), "utf8");
const flow = readFileSync(join(REPO_ROOT, ".maestro", "ci", "visual.yaml"), "utf8");

const bashArray = (name: string): string[] => {
  const body = script.match(new RegExp(`readonly ${name}=\\(([^)]*)\\)`))?.[1] ?? "";
  return body.split(/\s+/).filter(Boolean);
};

const SCREENS = bashArray("SCREENS");
const LOCALES = bashArray("LOCALES");
const THEMES = bashArray("THEMES");

/** The seed `seed_for` echoes for a screen: its case, or the `*` default. */
const seedFor = (screen: string): string | undefined => {
  const cases = [...script.matchAll(/^\s*([\w*-]+)\) echo "([^"]+)" ;;$/gm)];
  const match = cases.find(([, key]) => key === screen) ?? cases.find(([, key]) => key === "*");
  return match?.[2];
};

const flowValue = (key: string): string => {
  const value = flow.match(new RegExp(`^\\s*-?\\s*${key}:\\s*"([^"]+)"`, "m"))?.[1];
  if (!value) throw new Error(`visual.yaml has no quoted ${key}`);
  return value;
};

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\$\{(\w+)\}/g, (_, name: string) => vars[name] ?? `\${${name}}`);

const shots = SCREENS.flatMap((screen) =>
  LOCALES.flatMap((locale) => THEMES.map((theme) => ({ screen, locale, theme })))
);

describe("visual check", () => {
  it("covers eight screens in both locales and both themes", () => {
    expect(SCREENS).toHaveLength(8);
    expect([...LOCALES].sort()).toEqual([...SCREENSHOT_LOCALES].sort());
    expect([...THEMES].sort()).toEqual([...SCREENSHOT_THEMES].sort());
    expect(shots).toHaveLength(32);
  });

  it.each(shots)("opens a link the app accepts for $screen-$locale-$theme", (shot) => {
    const seed = seedFor(shot.screen) ?? "";
    const url = fill(flowValue("openLink"), {
      SCREEN: shot.screen,
      LOCALE: shot.locale,
      THEME: shot.theme,
      SEED: seed,
    });

    const link = parseScreenshotDeepLink(url);
    expect(link).toEqual({ screen: shot.screen, locale: shot.locale, theme: shot.theme, seed });
    expect(link && getPreset(link.screen, link.seed)).not.toBeNull();
  });

  it.each(shots)("waits for the marker the app shows for $screen-$locale", (shot) => {
    const link = parseScreenshotDeepLink(
      `myapp://screenshot/${shot.screen}?locale=${shot.locale}&seed=x`
    );
    if (!link) throw new Error(`${shot.screen}/${shot.locale} is not a screenshot key`);

    const id = fill(flowValue("id"), { SCREEN: shot.screen, LOCALE: shot.locale });
    expect(id).toBe(screenshotReadyId(link.screen, link.locale));
  });
});
