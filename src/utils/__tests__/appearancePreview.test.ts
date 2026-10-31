import { NATIVE_SCHEME } from "@/constants/Appearance";
import { PHASE, type Phase } from "@/constants/Phase";
import { PRAYER_ID } from "@/constants/Prayer";
import { AppLocale, AppMode } from "@/enums/app";
import i18n from "@/localization/i18n";
import { appearancePreview } from "@/utils/appearancePreview";

const t = i18n.t.bind(i18n);
const phaseCopy = (phase: Phase) => ({
  title: t(`settings.themes.phases.${phase}.title`),
  note: t(`settings.themes.phases.${phase}.note`),
});

// A phase that begins at a prayer goes by the prayer's name.
const PHASE_NAME: Record<Phase, string> = {
  [PHASE.DAWN]: `prayerTimes.${PRAYER_ID.FAJR}`,
  [PHASE.DAY]: `settings.themes.phases.${PHASE.DAY}.name`,
  [PHASE.ASR]: `prayerTimes.${PRAYER_ID.ASR}`,
  [PHASE.MAGHRIB]: `prayerTimes.${PRAYER_ID.MAGHRIB}`,
  [PHASE.NIGHT]: `settings.themes.phases.${PHASE.NIGHT}.name`,
};

describe("appearancePreview", () => {
  beforeAll(() => i18n.changeLanguage(AppLocale.EN));

  it.each(Object.values(PHASE))("names Adaptive's phase now: %s", (phase) => {
    const copy = appearancePreview(t, AppMode.ADAPTIVE, NATIVE_SCHEME.LIGHT, phase);

    expect(copy).toEqual({
      kicker: t("settings.themes.preview.adaptive", { phase: t(PHASE_NAME[phase]) }),
      ...phaseCopy(phase),
    });
  });

  // Before the day's times load, Adaptive draws the phone's scheme.
  it.each([
    [NATIVE_SCHEME.LIGHT, PHASE.DAY],
    [NATIVE_SCHEME.DARK, PHASE.NIGHT],
  ] as const)("waits for the times on a %s phone", (scheme, look) => {
    expect(appearancePreview(t, AppMode.ADAPTIVE, scheme, undefined)).toEqual({
      kicker: t("settings.themes.preview.adaptivePending"),
      title: phaseCopy(look).title,
      note: t("settings.themes.preview.adaptivePendingNote"),
    });
  });

  it.each([
    [NATIVE_SCHEME.LIGHT, "settings.themes.light.title", PHASE.DAY],
    [NATIVE_SCHEME.DARK, "settings.themes.dark.title", PHASE.NIGHT],
  ] as const)("names the scheme System follows: %s", (scheme, look, phase) => {
    expect(appearancePreview(t, AppMode.SYSTEM, scheme, PHASE.ASR)).toEqual({
      kicker: t("settings.themes.preview.system", { look: t(look) }),
      title: phaseCopy(phase).title,
      note: t("settings.themes.preview.systemNote"),
    });
  });

  // A fixed mode ignores the phase and the phone.
  it.each([
    [AppMode.LIGHT, "light", PHASE.DAY],
    [AppMode.DARK, "dark", PHASE.NIGHT],
  ] as const)("describes %s whatever the hour", (mode, name, phase) => {
    const expected = {
      kicker: t(`settings.themes.preview.${name}`),
      title: phaseCopy(phase).title,
      note: t(`settings.themes.preview.${name}Note`),
    };

    expect(appearancePreview(t, mode, NATIVE_SCHEME.DARK, PHASE.MAGHRIB)).toEqual(expected);
    expect(appearancePreview(t, mode, NATIVE_SCHEME.LIGHT, undefined)).toEqual(expected);
  });
});
