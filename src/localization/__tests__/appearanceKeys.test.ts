import { PHASE } from "@/constants/Phase";
import { AppLocale } from "@/enums/app";
import en from "@/localization/locales/en.json";
import ar from "@/localization/locales/ar.json";
import ms from "@/localization/locales/ms.json";
import ur from "@/localization/locales/ur.json";

const BUNDLES: Record<AppLocale, Record<string, unknown>> = {
  [AppLocale.EN]: en,
  [AppLocale.AR]: ar,
  [AppLocale.MS]: ms,
  [AppLocale.UR]: ur,
};

const keys = Object.keys(en).filter((key) => key.startsWith("settings.themes."));

/** The app name as a hand-written spelling, in any of its scripts. */
const HAND_WRITTEN_NAME = /nedaa|ن[ِ]?داء/i;

// A missing key falls back to English, so the screen never shows the gap.
describe.each(Object.values(AppLocale))("Appearance copy in %s", (locale) => {
  const bundle = BUNDLES[locale];

  it("finds the keys", () => {
    expect(keys.length).toBeGreaterThan(30);
  });

  it.each(keys)("defines %s", (key) => {
    expect(bundle[key]).toEqual(expect.stringMatching(/\S/));
  });

  // Fajr, Asr and Maghrib are named by prayerTimes.*, so no copy can drift.
  it("keeps no second name for a phase that begins at a prayer", () => {
    expect(
      Object.keys(bundle).filter((key) => /^settings\.themes\.phases\.\w+\.name$/.test(key))
    ).toEqual([PHASE.DAY, PHASE.NIGHT].map((phase) => `settings.themes.phases.${phase}.name`));
  });

  it("names the app only through brand.name", () => {
    expect(keys.filter((key) => HAND_WRITTEN_NAME.test(String(bundle[key])))).toEqual([]);
  });
});

// The design's words: the phase-following mode is the automatic one.
it("calls Adaptive «تلقائي» and System «النظام» in Arabic", () => {
  expect([ar["settings.themes.adaptive.title"], ar["settings.themes.system.title"]]).toEqual([
    "تلقائي",
    "النظام",
  ]);
});
